import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    letters: v.array(v.string()),
    targetWords: v.array(v.string()),
    bonusWords: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.letters.length !== 16) throw new Error("Board must have 16 letters");
    return await ctx.db.insert("rooms", args);
  },
});

// ponytail: returns the full solution to every client — fine for a co-op game with no stakes
export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => ctx.db.get(roomId),
});
