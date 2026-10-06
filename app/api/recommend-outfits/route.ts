import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const requestItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  color: z.string(),
  tone: z.string(),
  imageUrl: z.string().url(),
});

const recommendationSchema = z.object({
  outfits: z.array(z.object({
    title: z.string(),
    description: z.string(),
    itemIds: z.array(z.string()).min(1),
  })).min(1).max(4),
});

function isTransientError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details = `${error.name} ${error.message}`.toLowerCase();
  return details.includes("apiconnectionerror")
    || details.includes("unexpectedclienterror")
    || details.includes("network")
    || details.includes("timeout")
    || details.includes("unusable");
}

async function fetchImagePart(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Unable to load closet image (${response.status}).`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("A closet image URL did not return an image.");
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  return { inlineData: { data, mimeType: contentType } };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const items = z.array(requestItemSchema).min(1).parse(body.items);
    const imageParts = await Promise.all(items.map((item) => fetchImagePart(item.imageUrl)));
    const itemList = items.map((item, index) => (
      `Item ${index + 1} (id: ${item.id}): ${item.name}; category: ${item.category}; color: ${item.color}; tone: ${item.tone}`
    )).join("\n");

    const contents = [{
      role: "user" as const,
      parts: [
        {
          text: `Create up to four complete outfit recommendations using only the current closet items below.

Every outfit should include available clothing categories when possible: a top, pants, and shoes, with a jacket when one exists and fits. Do not invent clothing, colors, names, or item IDs. Use each item's exact id in itemIds. Make recommendations that visually coordinate based on the attached images.

Current closet:
${itemList}

Return concise outfit titles and descriptions.`,
        },
        ...items.flatMap((item, index) => [
          { text: `Image for item id ${item.id}:` },
          imageParts[index],
        ]),
      ],
    }];

    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(recommendationSchema),
          },
        });
        break;
      } catch (error) {
        if (!isTransientError(error) || attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    if (!response?.text) throw new Error("Gemini returned no outfit recommendations.");
    const result = recommendationSchema.parse(JSON.parse(response.text));
    const validIds = new Set(items.map((item) => item.id));
    const outfits = result.outfits.map((outfit) => ({
      ...outfit,
      itemIds: outfit.itemIds.filter((id) => validIds.has(id)),
    })).filter((outfit) => outfit.itemIds.length > 0);

    if (outfits.length === 0) throw new Error("Gemini did not use any current closet items.");
    return Response.json({ outfits });
  } catch (error) {
    console.error("Outfit recommendation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create outfit recommendations." },
      { status: 500 },
    );
  }
}
