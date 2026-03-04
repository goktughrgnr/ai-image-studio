"use node";

import { action } from "./_generated/server";

export const generatePrompt = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    const systemPrompt = `You generate image prompts for an AI art studio.
Write ONE vivid, detailed prompt (30-50 words). Complete sentences only.
Be specific about lighting, mood, colors, composition, and style.
Pick a random theme each time — fantasy, sci-fi, nature, surreal, retro, cyberpunk, cozy, horror, abstract, etc.
Return ONLY the prompt. No quotes, labels, or explanation.`;

    // Random number in user message forces unique outputs
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Surprise me. Seed: ${Math.random().toString(36).slice(2, 8)}` }],
            },
          ],
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 2.0,
            maxOutputTokens: 120,
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
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No text returned from Gemini");

    return text.trim().replace(/^["']|["']$/g, "");
  },
});

function sanitizeExternalError(errorText: string): string {
  return errorText.replace(/\s+/g, " ").slice(0, 300);
}
