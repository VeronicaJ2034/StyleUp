import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to your environment before using the clothing analyzer.");
  }

  return new GoogleGenAI({ apiKey });
}

const clothingSchema = z.object({
  category: z.enum(["shirt", "jacket", "pants", "shoes"]),
  color: z.string(),
  secondaryColor: z.string().nullable(),
  pattern: z.string(),
  style: z.string(),
  formality: z.enum(["casual", "smart-casual", "formal"]),
});

function isTransientGeminiError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const details = `${error.name} ${error.message}`.toLowerCase();
  return details.includes("apiconnectionerror")
    || details.includes("unexpectedclienterror")
    || details.includes("network")
    || details.includes("timeout")
    || details.includes("unusable");
}

async function analyzeWithRetry(base64Image: string, mimeType: string) {
  const maxAttempts = 3;
  const ai = getGeminiClient();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `
Analyze this clothing item for a digital wardrobe.

Identify the item using ONLY these categories:
- shirt
- jacket
- pants
- shoes

Classify trousers, jeans, leggings, shorts, and any other lower-body garment as "pants".
Use "shoes" only for footwear such as sneakers, boots, sandals, or dress shoes.
Do not classify a lower-body garment as "shoes".

Also identify:
- primary color
- secondary color, if there is one
- pattern
- overall style
- formality

Return only the requested structured information.
                `,
              },
              {
                inlineData: {
                  data: base64Image,
                  mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(clothingSchema),
        },
      });
    } catch (error) {
      if (!isTransientGeminiError(error) || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw new Error("Gemini analysis did not complete.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return Response.json(
        { error: "No image was provided." },
        { status: 400 }
      );
    }

      const imageBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const interaction = await analyzeWithRetry(base64Image, image.type || "image/jpeg");

    if (!interaction.text) {
      throw new Error("Gemini returned no text output.");
    }

    const result = clothingSchema.parse(JSON.parse(interaction.text));

    return Response.json(result);
  } catch (error) {
    console.error("Clothing analysis error:", error);

    return Response.json(
      { error: "Failed to analyze clothing item." },
      { status: 500 }
    );
  }
}