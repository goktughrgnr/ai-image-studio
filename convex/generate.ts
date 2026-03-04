"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import sharp from "sharp";

const GEMINI_MODELS = new Set([
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
]);

const ALLOWED_ENGINES = new Set([
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
]);

const ALLOWED_STYLES = new Set(["none", "comic", "3d toon", "sketch", "pop art"]);
const ALLOWED_CANVAS = new Set(["square", "classic", "tall"]);
const MAX_BATCH_SIZE = 10;
const API_BATCH_LIMIT = 4;

export const generate = action({
  args: {
    generationId: v.id("generations"),
    prompt: v.string(),
    negativePrompt: v.optional(v.string()),
    style: v.string(),
    canvasShape: v.string(),
    engine: v.string(),
    batchSize: v.number(),
  },
  handler: async (ctx, args) => {
    validateArgs(args);

    await ctx.runMutation(internal.generations.updateStatus, {
      id: args.generationId,
      status: "generating",
    });

    const aspectRatioMap: Record<string, string> = {
      square: "1:1",
      classic: "4:3",
      tall: "3:4",
    };

    const stylePromptMap: Record<string, string> = {
      none: "",
      comic: "comic book style illustration,",
      "3d toon": "3D cartoon rendered style,",
      sketch: "hand-drawn pencil sketch style,",
      "pop art": "pop art style, bold colors, halftone dots,",
    };

    const stylePrefix = stylePromptMap[args.style.toLowerCase()] ?? "";
    const basePrompt = `${stylePrefix} ${args.prompt.trim()}`.trim();
    const negativePrompt = args.negativePrompt
      ?.trim()
      .replace(/\s+/g, " ")
      .replace(/[.;,\s]+$/, "");
    const fullPrompt = negativePrompt
      ? `${basePrompt}\n\nImportant constraints:\n- Do not include: ${negativePrompt}.\n- Exclude any visual elements matching that list.`
      : basePrompt;
    const aspectRatio = aspectRatioMap[args.canvasShape.toLowerCase()] || "4:3";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.generations.updateStatus, {
        id: args.generationId,
        status: "failed",
        error: "Server configuration error",
      });
      return;
    }

    const isGemini = GEMINI_MODELS.has(args.engine);

    try {
      const imageBuffers: Buffer[] = isGemini
        ? await callGemini(apiKey, args.engine, fullPrompt, args.batchSize)
        : await callImagen(apiKey, args.engine, fullPrompt, aspectRatio, args.batchSize);

      const imageIds: Id<"_storage">[] = [];
      const thumbnailIds: Id<"_storage">[] = [];
      const originalIds: Id<"_storage">[] = [];

      for (const buffer of imageBuffers) {
        // Store original PNG for downloads
        const originalBlob = new Blob([new Uint8Array(buffer)], {
          type: "image/png",
        });
        const originalId = await ctx.storage.store(originalBlob);
        originalIds.push(originalId);

        // WebP for lightbox viewing (much smaller than PNG)
        const webpBuffer = await sharp(buffer)
          .webp({ quality: 85 })
          .toBuffer();
        const fullBlob = new Blob([new Uint8Array(webpBuffer)], {
          type: "image/webp",
        });
        const storageId = await ctx.storage.store(fullBlob);
        imageIds.push(storageId);

        // Thumbnail for gallery cards (300px, low quality)
        const thumbBuffer = await sharp(buffer)
          .resize(300, 300, { fit: "cover" })
          .webp({ quality: 60 })
          .toBuffer();
        const thumbBlob = new Blob([new Uint8Array(thumbBuffer)], {
          type: "image/webp",
        });
        const thumbId = await ctx.storage.store(thumbBlob);
        thumbnailIds.push(thumbId);
      }

      await ctx.runMutation(internal.generations.updateStatus, {
        id: args.generationId,
        status: "complete",
        imageIds,
        thumbnailIds,
        originalIds,
      });
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : "Unknown error";
      // Store sanitized detail for debugging, return generic message to client
      const isApiError = rawMsg.includes("API error");
      const storedError = isApiError
        ? rawMsg.replace(/x-goog-api-key\s*[=:]\s*\S+/gi, "[REDACTED]")
        : rawMsg;
      await ctx.runMutation(internal.generations.updateStatus, {
        id: args.generationId,
        status: "failed",
        error: storedError.slice(0, 300),
      });
      throw new Error(
        isApiError ? "Image generation service error. Please try again." : rawMsg,
      );
    }
  },
});

async function callImagen(
  apiKey: string,
  modelId: string,
  prompt: string,
  aspectRatio: string,
  batchSize: number,
): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  let remaining = batchSize;

  while (remaining > 0) {
    const sampleCount = Math.min(remaining, API_BATCH_LIMIT);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount,
            aspectRatio,
            personGeneration: "allow_adult",
            outputOptions: { mimeType: "image/png" },
          },
        }),
      },
    );

    if (!response.ok) {
      const errData = await response.text();
      throw new Error(
        `Imagen API error ${response.status}: ${sanitizeExternalError(errData)}`,
      );
    }

    const result = await response.json();
    const predictions = result.predictions || [];

    for (const pred of predictions) {
      if (pred.bytesBase64Encoded) {
        buffers.push(Buffer.from(pred.bytesBase64Encoded, "base64"));
      }
    }

    remaining -= sampleCount;
  }

  if (buffers.length === 0) {
    throw new Error("No image returned from Imagen");
  }

  return buffers.slice(0, batchSize);
}

async function callGemini(
  apiKey: string,
  modelId: string,
  prompt: string,
  batchSize: number,
): Promise<Buffer[]> {
  const buffers: Buffer[] = [];

  // Gemini generateContent returns 1 image per call, so loop for batchSize
  const count = batchSize;
  const promises = Array.from({ length: count }, async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Generate an image: ${prompt}` }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      },
    );

    if (!response.ok) {
      const errData = await response.text();
      throw new Error(
        `Gemini API error ${response.status}: ${sanitizeExternalError(errData)}`,
      );
    }

    const result = await response.json();
    const candidates = result.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return Buffer.from(part.inlineData.data, "base64");
        }
      }
    }
    throw new Error("No image returned from Gemini");
  });

  const results = await Promise.allSettled(promises);
  for (const r of results) {
    if (r.status === "fulfilled") buffers.push(r.value);
  }

  if (buffers.length === 0) {
    throw new Error("All Gemini image generation requests failed");
  }

  return buffers;
}

function sanitizeExternalError(errorText: string): string {
  // Strip potential API keys, tokens, or sensitive headers from error text
  return errorText
    .replace(/\s+/g, " ")
    .replace(/key[=:]\s*\S+/gi, "key=[REDACTED]")
    .replace(/token[=:]\s*\S+/gi, "token=[REDACTED]")
    .replace(/authorization[=:]\s*\S+/gi, "authorization=[REDACTED]")
    .slice(0, 200);
}

function validateArgs(args: {
  prompt: string;
  negativePrompt?: string;
  style: string;
  canvasShape: string;
  engine: string;
  batchSize: number;
  generationId: Id<"generations">;
}): void {
  const prompt = args.prompt.trim();
  if (prompt.length < 3 || prompt.length > 1000) {
    throw new Error("Invalid prompt length");
  }

  const negativePrompt = args.negativePrompt?.trim();
  if (negativePrompt && negativePrompt.length > 500) {
    throw new Error("Invalid negative prompt length");
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
    throw new Error("Invalid batch size");
  }
}
