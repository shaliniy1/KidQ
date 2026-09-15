// Imported first by integration tests so src/config/env sees fake keys. Every outbound call is
// served by fixtures (tests must not spend API quota or call paid models — README).
process.env.YOUTUBE_DATA_API_KEY ??= "test-youtube-key";
process.env.GEMINI_API_KEY ??= "test-gemini-key";
// One fallback model keeps the model-chain tests simple.
process.env.AI_FALLBACK_MODELS ??= "gemini-3.7-flash";
