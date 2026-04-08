import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

/**
 * Layer 1: STT (Speech-to-Text)
 *
 * Uses gpt-4o-mini-transcribe (OpenAI recommended, 2025+) for Japanese transcription.
 * Significantly better accuracy than whisper-1 for accents, noisy environments,
 * and domain-specific vocabulary.
 *
 * Returns: { text, debug: { model, duration_ms, audio_size } }
 */

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const STT_TIMEOUT_MS = 10_000; // 10 seconds

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Domain vocabulary prompt — keep minimal to avoid Whisper echoing it back
const DOMAIN_PROMPT = "";

// Hallucination patterns: common Whisper artifacts on silent/echo audio
// NOTE: Do NOT filter short legitimate answers like "はい" — users may give short affirmations
const HALLUCINATION_PATTERNS = [
  /^ご視聴ありがとうございま(す|した)[。！]?$/,
  /^ありがとうございました[。！]?$/,
  /^チャンネル登録/,
  /^高評価/,
  /^字幕/,
  /^(ご覧|ご視聴)いただき/,
  /^お疲れ様でした[。！]?$/,
];

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const openai = getOpenAI();
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const extraPrompt = (formData.get("prompt") as string) || "";

    if (!audioFile || audioFile.size === 0) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Validate file size
    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: `Audio file too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB > 10MB limit)` },
        { status: 400 }
      );
    }

    // Validate MIME type (allow audio/* and common container types)
    const mimeType = audioFile.type || "";
    if (mimeType && !mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) {
      return NextResponse.json(
        { error: `Invalid file type: ${mimeType}. Expected audio/*` },
        { status: 400 }
      );
    }

    const audioSize = audioFile.size;
    const prompt = extraPrompt
      ? `${DOMAIN_PROMPT} ${extraPrompt}`
      : DOMAIN_PROMPT;

    // Use gpt-4o-mini-transcribe for much better accuracy
    // Falls back to whisper-1 if the new model fails
    let text = "";
    let model = "gpt-4o-mini-transcribe";

    // Create AbortSignal for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), STT_TIMEOUT_MS);

    try {
      const transcription = await openai.audio.transcriptions.create(
        {
          file: audioFile,
          model: "gpt-4o-mini-transcribe",
          language: "ja",
          prompt,
        },
        { signal: abortController.signal }
      );
      text = transcription.text || "";
    } catch (modelErr: any) {
      if (modelErr.name === "AbortError") {
        throw new Error("STT timeout: transcription took too long");
      }
      // 4-5: Fallback to whisper-1 with a FRESH AbortController + timeout
      // (the original timer may have nearly expired, leaving insufficient time)
      console.warn("[STT] gpt-4o-mini-transcribe failed, falling back to whisper-1:", modelErr.message);
      model = "whisper-1 (fallback)";
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), STT_TIMEOUT_MS);
      try {
        const transcription = await openai.audio.transcriptions.create(
          {
            file: audioFile,
            model: "whisper-1",
            language: "ja",
            response_format: "json",
            prompt,
            temperature: 0,
          },
          { signal: fallbackController.signal }
        );
        text = transcription.text || "";
      } finally {
        clearTimeout(fallbackTimeoutId);
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Filter out STT hallucination / echo artifacts
    const trimmedText = text.trim();
    const isHallucination = HALLUCINATION_PATTERNS.some((p) => p.test(trimmedText));

    if (isHallucination) {
      console.warn("[STT] Filtered hallucination:", trimmedText);
      text = "";
    }

    console.log("[STT] Result:", JSON.stringify({ text: text.substring(0, 100), audioSize, isHallucination }));

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      text,
      debug: {
        model,
        duration_ms: durationMs,
        audio_size: audioSize,
        filtered: isHallucination ? trimmedText : undefined,
      },
    });
  } catch (err: any) {
    console.error("[STT] API error:", err);
    return NextResponse.json(
      { error: err.message || "Transcription failed" },
      { status: 500 }
    );
  }
}
