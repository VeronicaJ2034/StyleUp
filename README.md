# StyleUp

StyleUp is a browser-based wardrobe organization and fashion recommendation app designed to help users organize their clothing, discover outfit combinations, and make outfit planning easier.

The application is presented inside a responsive phone-shaped preview. The phone frame is a visual design component only; the app uses standard Next.js, React, TypeScript, HTML, and CSS.

## Current Features

* Responsive digital closet interface
* Clothing category organization
* Outfit-match carousel
* Loading screen
* Tab navigation
* Clothing item cards and styling
* Shopping catalog with a pre-loved marketplace for publishing, browsing, and preview-purchasing secondhand listings
* Add clothing interface
* Style friends area with Instagram and Snapchat connection previews
* Conceptual try-on studio with a customizable style model
* Gemini-powered clothing image analysis
* Structured clothing attributes including:

  * Category
  * Primary color
  * Secondary color
  * Pattern
  * Style
  * Formality

The current Gemini integration analyzes uploaded clothing images and returns structured information that will later be used by StyleUp's outfit-matching algorithm.

## Planned Features

* Custom outfit-matching algorithm
* Personalized outfit recommendations
* Seasonal outfit recommendations based on location and weather
* Clothing wear-frequency tracking
* Identification of clothing items that may be good candidates to sell
* Virtual try-on functionality with personalized model measurements and appearance
* Social fashion connections and shared style inspiration
* Potential integration with clothing brand websites
* Persistent wardrobe storage
* User accounts and backend services

## Getting Started

### Prerequisites

Make sure you have Node.js and npm installed.

### Install dependencies

```sh
npm install
```

### Environment Variables

StyleUp uses Gemini to analyze clothing images, Groq to create outfit recommendations, and Supabase for optional email/password accounts and account profile photos.

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GROQ_API_KEY=YOUR_GROQ_API_KEY
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Do not commit `.env.local` to GitHub. API keys and other secrets should be kept out of source control.

A `.env.example` file can be used to show teammates which environment variables are required without exposing the actual key:

```env
GEMINI_API_KEY=
GROQ_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Each developer should create their own `.env.local` file with their own API key.

Use exactly one `=` after each variable name, with no extra spaces:

```env
GROQ_API_KEY=gsk_your_groq_api_key
```

After changing `.env.local`, restart the Next.js development server so the new values are loaded.

The shopping catalog includes men's and women's sections, with a toggle above the store and category filters. Both sections use locally stored AI-generated illustrations. Store names are organizational placeholders; the images are not verified retailer products. Prices, product details, reviews, and checkout are illustrative.

The pre-loved marketplace requires selecting a photographed clothing item from your closet to create a listing. Closet item previews are shown in the picker, and the selection prefills the listing name and category. Browse and search listings by brand or item, then complete a simulated purchase. Listings are stored in the current browser's local storage and are not shared with other users or devices. Payments, shipping, seller payouts, and real orders are not connected.

### Supabase accounts and profile photos

1. Create a Supabase project and copy its project URL and public anon/publishable key into `.env.local` using the variable names above. These public values are safe to use in the browser; never put a service-role key in a `NEXT_PUBLIC_` variable.
2. In the Supabase SQL Editor, run [`supabase/profile-photos.sql`](supabase/profile-photos.sql). It creates the public profile-photo bucket (5 MB maximum; JPG, PNG, and WebP) and policies that limit uploads, updates, and deletes to the signed-in user’s own folder.
3. Enable email/password authentication in Supabase Auth. For local development, add `http://localhost:3000` to the allowed site URLs.
4. Restart the Next.js development server after adding environment variables. Select the circular StyleUp logo to create an account or sign in, then add a profile photo. During sign-up, users may optionally provide their birthday; signed-in users can edit it from their account panel. The birthday is stored in that user’s Supabase Auth metadata. The profile photo is stored under the authenticated user’s ID and will appear on that account on other devices.

The photo bucket is public so the avatar can load without expiring signed URLs. Only authenticated users can write to their own user-ID folder; the public anon key does not grant service-level access.

### Run locally

```sh
npm run dev
```

Open http://localhost:3000.

The phone preview stays at an iPhone-like size on larger screens, scales down on smaller screens, and keeps its content vertically scrollable inside the device frame.

## Gemini Clothing Analysis

The Gemini integration is handled through a server-side Next.js API route:

```text
app/api/analyze-clothing/route.ts
```

The general flow is:

```text
Clothing Image
      ↓
Next.js API Route
      ↓
Gemini Image Analysis
      ↓
Structured Clothing Data
      ↓
StyleUp Outfit-Matching Algorithm
```

The API keys are accessed server-side through `GEMINI_API_KEY` and `GROQ_API_KEY` rather than being exposed to the browser. Gemini is used for clothing-image analysis, while Groq is used for outfit recommendations.

## Groq Outfit Recommendations

Outfit recommendations are generated by the server-side route:

```text
app/api/recommend-outfits/route.ts
```

The route uses Groq's vision-capable `qwen/qwen3.8-27b` model. It sends clothing metadata for every closet item and up to three clothing images, because Groq's vision endpoint supports a maximum of three images per request. The model returns a JSON object containing outfit titles, descriptions, and closet item IDs. The response is validated before it is shown in the app.

Create a Groq API key from the [Groq Console](https://console.groq.com/keys) and store it only in `.env.local` as `GROQ_API_KEY`. Do not commit API keys to source control.

## Testing Gemini

A temporary test page is available at:

```text
http://localhost:3000/api-test
```

This page allows developers to upload a clothing imag