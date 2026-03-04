import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  generations: defineTable({
    prompt: v.string(),
    negativePrompt: v.optional(v.string()),
    style: v.string(),
    canvasShape: v.string(),
    engine: v.string(),
    batchSize: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("complete"),
      v.literal("failed")
    ),
    imageIds: v.optional(v.array(v.id("_storage"))),
    thumbnailIds: v.optional(v.array(v.id("_storage"))),
    originalIds: v.optional(v.array(v.id("_storage"))),
    error: v.optional(v.string()),
  }).index("by_status", ["status"]),
});
