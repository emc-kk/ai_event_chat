import OpenAI from "openai";
import { NextRequest } from "next/server";

/**
 * Layer 3: TTS (Text-to-Speech)
 *
 * Receives text from Layer 2 (hearing agent / QA agent response),
 * sends to OpenAI TTS API, returns audio/mpeg stream for browser playback.
 */

const MAX_TEXT_LENGTH = 4096; // OpenAI TTS limit
const TTS_TIMEOUT_MS = 8_000; // 8 seconds
// 11-1: gpt-4o-mini-tts supports all 13 voices including new ones
const VALID_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "onyx", "nova", "sage", "shimmer", "verse",
] as const;
type TTSVoice = typeof VALID_VOICES[number];

// 11-1: Japanese-optimized voice instruction for gpt-4o-mini-tts
const JAPANESE_VOICE_INSTRUCTION =
  "自然で聞き取りやすい日本語で話してください。丁寧語を使い、落ち着いた速度で、" +
  "はっきりとした発音で読み上げてください。ビジネスの専門家として話すトーンで。";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest) {
  try {
    const openai = getOpenAI();
    const { text, voice: rawVoice = "coral", instructions: customInstructions } = await req.json();

    // 5-4: Validate voice parameter (default changed to "coral" for better Japanese)
    const voice: TTSVoice = VALID_VOICES.includes(rawVoice) ? rawVoice : "coral";

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate text length (OpenAI TTS limit)
    const inputText = text.length > MAX_TEXT_LENGTH
      ? text.slice(0, MAX_TEXT_LENGTH)
      : text;

    // Timeout for TTS API call
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TTS_TIMEOUT_MS);

    let mp3Response;
    try {
      // 11-1: Use gpt-4o-mini-tts for higher quality Japanese pronunciation
      // with voice instructions for natural, clear business-tone speech
      mp3Response = await openai.audio.speech.create(
        {
          model: "gpt-4o-mini-tts",
          voice: voice,
          input: inputText,
          instructions: customInstructions || JAPANESE_VOICE_INSTRUCTION,
          response_format: "mp3",
          speed: 1.05, // Slightly faster but not as aggressive for clearer pronunciation
        },
        { signal: abortController.signal }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    // Guard against null body
    const body = mp3Response.body;
    if (!body) {
      return new Response(JSON.stringify({ error: "TTS returned empty response" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the audio response back to the client
    return new Response(body as ReadableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("[TTS] Timeout: TTS generation took too long");
      return new Response(JSON.stringify({ error: "TTS timeout" }), {
        status: 504,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("[TTS] OpenAI TTS error:", err);
    return new Response(JSON.stringify({ error: err.message || "TTS failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
