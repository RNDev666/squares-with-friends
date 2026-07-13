import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const join = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_room_session", (q) =>
        q.eq("roomId", args.roomId).eq("sessionId", args.sessionId)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name: args.name, lastSeenAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("players", { ...args, lastSeenAt: Date.now() });
  },
});

export const heartbeat = mutation({
  args: { playerId: v.id("players") },
  handler: async (ctx, { playerId }) => {
    await ctx.db.patch(playerId, { lastSeenAt: Date.now() });
  },
});

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) =>
    ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect(),
});
