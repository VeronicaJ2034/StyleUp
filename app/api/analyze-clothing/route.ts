import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const clothingSchema = z.object({
  category: z.enum(["shirt", "jacket", "pants", "shoes"]),
  color: z.string(),
  secondaryColor: z.string().nullable(),
  pattern: z.string(),
  style: z.string(),
  formality: z.enum(["casual", "smart-casual", "formal"]),
});

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

    const interaction = await ai.interactions.create({
      model: "gemini-3.8-flash",
      input: [
        {
          type: "text",
          text: `
Analyze this clothing item for a digital wardrobe.

Identify the item using ONLY these categories:
- shirt
- jacket
- pants
- shoes

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
  type: "image",
  data: base64Image,
  mime_type: image.type || "image/jpeg",
},
      ],
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: z.toJSONSchema(clothingSchema),
      },
    });

    if (!interaction.output_text) {
  throw new Error("Gemini returned no text output.");
}

const result = clothingSchema.parse(
  JSON.parse(interaction.output_text)
);

    return Response.json(result);
  } catch (error) {
    console.error("Clothing analysis error:", error);

    return Response.json(
      { error: "Failed to analyze clothing item." },
      { status: 500 }
    );
  }
}