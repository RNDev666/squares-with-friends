import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const submit = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    word: v.string(),
  },
  handler: async (ctx, args) => {
    const word = args.word.toLowerCase();
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");

    if (!room.words.includes(word)) return { result: "invalid" as const };

    const dupe = await ctx.db
      .query("finds")
      .withIndex("by_room_word", (q) => q.eq("roomId", args.roomId).eq("word", word))
      .unique();
    if (dupe) {
      const finder = await ctx.db.get(dupe.playerId);
      return { result: "duplicate" as const, by: finder?.name ?? "someone" };
    }

    await ctx.db.insert("finds", { roomId: args.roomId, playerId: args.playerId, word });
    return { result: "found" as const };
  },
});

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const finds = await ctx.db
      .query("finds")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const cache = new Map<string, { name: string; color: string }>();
    const out = [];
    for (const f of finds) {
      if (!cache.has(f.playerId)) {
        const p = await ctx.db.get(f.playerId);
        cache.set(f.playerId, { name: p?.name ?? "?", color: p?.color ?? "#888" });
      }
      const { name, color } = cache.get(f.playerId)!;
      out.push({ word: f.word, foundAt: f._creationTime, playerId: f.playerId, name, color });
    }
    return out;
  },
});
