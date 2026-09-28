"use client";

import { useState } from "react";

export default function ApiTest() {
  const [result, setResult] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyzeClothing(file: File) {
    setLoading(true);
    setResult("");

    // Show the selected image
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("/api/analyze-clothing", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult("Something went wrong while contacting the API.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "700px" }}>
      <h1>StyleUp Gemini Test</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            analyzeClothing(file);
          }
        }}
      />

      {imagePreview && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Uploaded Clothing</h2>

          <img
            src={imagePreview}
            alt="Uploaded clothing"
            style={{
              maxWidth: "300px",
              maxHeight: "400px",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      {loading && <p>Analyzing clothing...</p>}

      {result && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Gemini Analysis</h2>

          <pre
            style={{
              padding: "1rem",
              background: "#f4f4f4",
              borderRadius: "8px",
              overflowX: "auto",
            }}
          >
            {result}
          </pre>
        </div>
      )}
    </main>
  );
}