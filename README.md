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
* Add clothing interface
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
* Virtual try-on functionality
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

StyleUp uses the Gemini API to analyze clothing images.

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Do not commit `.env.local` to GitHub. API keys and other secrets should be kept out of source control.

A `.env.example` file can be used to show teammates which environment variables are required without exposing the actual key:

```env
GEMINI_API_KEY=
```

Each developer should create their own `.env.local` file with their own API key.

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

The API key is accessed server-side through `GEMINI_API_KEY` rather than being exposed to the browser.

## Testing Gemini

A temporary test page is available at:

```text
http://localhost:3000/api-test
```

This page allows developers to upload a clothing imag