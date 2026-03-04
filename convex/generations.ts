import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

const ALLOWED_STYLES = new Set(["none", "comic", "3d toon", "sketch", "pop art"]);
const ALLOWED_CANVAS = new Set(["square", "classic", "tall"]);
const ALLOWED_ENGINES = new Set([
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
]);

const MAX_PROMPT_LENGTH = 1000;
const MAX_NEGATIVE_PROMPT_LENGTH = 500;
const MAX_BATCH_SIZE = 10;
const MAX_PENDING_JOBS = 30;
const MAX_REQUESTS_PER_MINUTE = 30;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const generations = await ctx.db
      .query("generations")
      .order("desc")
      .take(50);

    const results = await Promise.all(
      generations.map(async (gen) => {
        const [imageUrls, thumbnailUrls, originalUrls] = await Promise.all([
          gen.imageIds
            ? Promise.all(gen.imageIds.map((id) => ctx.storage.getUrl(id)))
            : Promise.resolve([]),
          gen.thumbnailIds
            ? Promise.all(gen.thumbnailIds.map((id) => ctx.storage.getUrl(id)))
            : Promise.resolve([]),
          gen.originalIds
            ? Promise.all(gen.originalIds.map((id) => ctx.storage.getUrl(id)))
            : Promise.resolve([]),
        ]);
        return {
          ...gen,
          imageUrls: imageUrls.filter((url): url is string => url !== null),
          thumbnailUrls: thumbnailUrls.filter((url): url is string => url !== null),
          originalUrls: originalUrls.filter((url): url is string => url !== null),
        };
      }),
    );
    return results;
  },
});

export const create = mutation({
  args: {
    prompt: v.string(),
    negativePrompt: v.optional(v.string()),
    style: v.string(),
    canvasShape: v.string(),
    engine: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    const normalizedPrompt = args.prompt.trim();
    if (normalizedPrompt.length < 3 || normalizedPrompt.length > MAX_PROMPT_LENGTH) {
      throw new Error("Prompt length must be between 3 and 1000 characters");
    }

    const normalizedNegativePrompt = args.negativePrompt?.trim();
    if (normalizedNegativePrompt && normalizedNegativePrompt.length > MAX_NEGATIVE_PROMPT_LENGTH) {
      throw new Error("Negative prompt is too long");
    }

    if (!ALLOWED_STYLES.has(args.style.toLowerCase())) {
      throw new Error("Invalid style");
    }

    if (!ALLOWED_CANVAS.has(args.canvasShape.toLowerCase())) {
      throw new Error("Invalid canvas shape");
    }

    if (!ALLOWED_ENGINES.has(args.engine)) {
      throw new Error("Invalid engine");
    }

    if (!Number.isInteger(args.batchSize) || args.batchSize < 1 || args.batchSize > MAX_BATCH_SIZE) {
      throw new Error("Batch size must be between 1 and 10");
    }

    const recent = await ctx.db
      .query("generations")
      .order("desc")
      .take(100);

    const now = Date.now();
    const minuteAgo = now - 60_000;
    const recentCount = recent.filter((g) => g._creationTime >= minuteAgo).length;
    if (recentCount >= MAX_REQUESTS_PER_MINUTE) {
      throw new Error("Rate limit exceeded. Please wait a moment and retry.");
    }

    const activeCount = recent.filter(
      (g) => g.status === "pending" || g.status === "generating",
    ).length;
    if (activeCount >= MAX_PENDING_JOBS) {
      throw new Error("Service is busy. Please retry in a few moments.");
    }

    return await ctx.db.insert("generations", {
      ...args,
      prompt: normalizedPrompt,
      negativePrompt: normalizedNegativePrompt,
      status: "pending",
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.id("generations"),
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
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("generations") },
  handler: async (ctx, args) => {
    const gen = await ctx.db.get(args.id);
    if (gen) {
      const allIds = [...(gen.imageIds ?? []), ...(gen.thumbnailIds ?? []), ...(gen.originalIds ?? [])];
      await Promise.all(allIds.map((id) => ctx.storage.delete(id)));
    }
    await ctx.db.delete(args.id);
  },
});
