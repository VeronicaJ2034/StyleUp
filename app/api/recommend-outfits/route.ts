import Groq from "groq-sdk";
import * as z from "zod";

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing. Add it to your environment before using outfit recommendations.");
  }

  return new Groq({ apiKey });
}

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
    || details.includes("unusable")
    || details.includes("high demand")
    || details.includes("overloaded")
    || details.includes("temporarily unavailable")
    || details.includes("service unavailable")
    || details.includes("resource_exhausted")
    || details.includes("rate limit")
    || details.includes("rate_limit")
    || details.includes("429")
    || details.includes("503");
}

function isProviderUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details = `${error.name} ${error.message}`.toLowerCase();
  return details.includes("high demand")
    || details.includes("overloaded")
    || details.includes("temporarily unavailable")
    || details.includes("service unavailable")
    || details.includes("resource_exhausted")
    || details.includes("rate limit")
    || details.includes("rate_limit")
    || details.includes("429")
    || details.includes("503");
}

async function fetchImagePart(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Unable to load closet image (${response.status}).`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("A closet image URL did not return an image.");
  const data = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${data}`;
}

export async function POST(request: Request) {
  try {
    const ai = getGroqClient();
    const body = await request.json();
    const items = z.array(requestItemSchema).min(1).parse(body.items);
    const imageParts = await Promise.all(items.map((item) => fetchImagePart(item.imageUrl)));
    const itemList = items.map((item, index) => (
      `Item ${index + 1} (id: ${item.id}): ${item.name}; category: ${item.category}; color: ${item.color}; tone: ${item.tone}`
    )).join("\n");

    const prompt = `Create up to four complete outfit recommendations using only the current closet items below.

Every outfit should include available clothing categories when possible: a top, pants, and shoes, with a jacket when one exists and fits. Do not invent clothing, colors, names, or item IDs. Use each item's exact id in itemIds. Make recommendations that visually coordinate based on the attached images.

Current closet:
${itemList}

Return concise outfit titles and descriptions as a valid JSON object with an "outfits" array.`;
    const contents = [
      { type: "text" as const, text: prompt },
      ...items.slice(0, 3).flatMap((item, index) => [
        { type: "text" as const, text: `Image for item id ${item.id}:` },
        { type: "image_url" as const, image_url: { url: imageParts[index] } },
      ]),
    ];

    let response: Groq.Chat.Completions.ChatCompletion | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        response = await ai.chat.completions.create({
          model: "qwen/qwen3.8-27b",
          messages: [{ role: "user", content: contents }],
          response_format: { type: "json_object" },
        });
        break;
      } catch (error) {
        if (!isTransientError(error) || attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    const responseText = response?.choices[0]?.message.content;
    if (!responseText) throw new Error("Groq returned no outfit recommendations.");
    const result = recommendationSchema.parse(JSON.parse(responseText));
    const validIds = new Set(items.map((item) => item.id));
    const outfits = result.outfits.map((outfit) => ({
      ...outfit,
      itemIds: outfit.itemIds.filter((id) => validIds.has(id)),
    })).filter((outfit) => outfit.itemIds.length > 0);

    if (outfits.length === 0) throw new Error("Groq did not use any current closet items.");
    return Response.json({ outfits });
  } catch (error) {
    console.error("Outfit recommendation error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to create outfit recommendations." },
      { status: isProviderUnavailable(error) ? 503 : 500 },
    );
  }
}
