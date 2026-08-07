import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    letters: v.array(v.string()),
    words: v.array(v.string()),
  }),
  players: defineTable({
    roomId: v.id("rooms"),
    sessionId: v.string(),
    name: v.string(),
    color: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_session", ["roomId", "sessionId"]),
  finds: defineTable({
    roomId: v.id("rooms"),
    playerId: v.id("players"),
    word: v.string(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_word", ["roomId", "word"]),
});
