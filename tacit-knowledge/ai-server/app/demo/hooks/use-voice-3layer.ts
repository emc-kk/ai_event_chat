"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Voice Hook (MediaRecorder + OpenAI Whisper API版)
 * - チャンクごとに累積音声を送信し、差分のみをonTranscriptに渡す
 * - WebMヘッダー問題を回避するため、常にchunks[0]からの累積blobを送信する
 */

export type VoicePhase =
  | "disconnected"
  | "connecting"
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

export type RealtimePhase = VoicePhase;

interface Voice3LayerState {
  phase: VoicePhase;
  isConnected: boolean;
  userTranscript: string;
  error: string | null;
  lastSTTDebug: null;
}

interface UseVoice3LayerOptions {
  onTranscript?: (transcript: string) => void;
  onRecordingStop?: () => void;
  silenceTimeout?: number;
  volumeThreshold?: number;
  voiceFramesRequired?: number;
  autoStartVAD?: boolean;
}

const CHUNK_INTERVAL_MS = 4000; // 4秒ごとに中間文字起こし

export function useVoice3Layer(options: UseVoice3LayerOptions = {}) {
  const { onTranscript } = options;

  const [state, setState] = useState<Voice3LayerState>({
    phase: "disconnected",
    isConnected: false,
    userTranscript: "",
    error: null,
    lastSTTDebug: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");
  const phaseRef = useRef<VoicePhase>("disconnected");
  const onTranscriptRef = useRef(onTranscript);
  const prevFullTranscriptRef = useRef<string>("");
  const processingRef = useRef(false);
  const sessionIdRef = useRef(0); // disconnectのたびにインクリメント、古いSTT結果を破棄

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  // 累積チャンクをSTTに送り、前回との差分だけonTranscriptに渡す
  const sendCumulativeToSTT = useCallback(async () => {
    if (processingRef.current) return;
    if (chunksRef.current.length === 0) return;

    processingRef.current = true;
    const sessionAtStart = sessionIdRef.current; // このSTTリクエスト開始時のセッションID
    try {
      const audioBlob = new Blob(chunksRef.current, {
        type: mimeTypeRef.current || "audio/webm",
      });
      if (audioBlob.size < 1000) return;

      const mimeType = audioBlob.type;
      let filename = "audio.webm";
      if (mimeType.includes("ogg")) filename = "audio.ogg";
      else if (mimeType.includes("mp4") || mimeType.includes("m4a"))
        filename = "audio.mp4";

      const formData = new FormData();
      formData.append(
        "audio",
        new File([audioBlob], filename, { type: mimeType })
      );
      formData.append("prompt", "");

      const res = await fetch("/api/demo/voice/stt", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return;

      const data = await res.json();
      const newFull = (data.text || "").trim();
      if (!newFull) return;

      // セッションIDが変わっていたら（disconnect済み）結果を破棄
      if (sessionIdRef.current !== sessionAtStart) return;

      // 累積テキスト全体をそのままコールバックに渡す（差分計算をやめてシンプルに）
      prevFullTranscriptRef.current = newFull;
      onTranscriptRef.current?.(newFull);
      setState((s) => ({ ...s, userTranscript: newFull }));
    } catch (err) {
      console.error("[STT] Error:", err);
    } finally {
      processingRef.current = false;
    }
  }, []);

  const connect = useCallback(async () => {
    if (phaseRef.current !== "disconnected") return;

    phaseRef.current = "connecting";
    setState((s) => ({ ...s, phase: "connecting", error: null }));

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      phaseRef.current = "disconnected";
      setState({
        phase: "disconnected",
        isConnected: false,
        userTranscript: "",
        error:
          "マイクを使うにはHTTPS接続が必要です。ngrokのURLを使ってください。",
        lastSTTDebug: null,
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      mimeTypeRef.current = mimeType || "audio/webm";
      prevFullTranscriptRef.current = "";
      processingRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && phaseRef.current !== "disconnected") {
          chunksRef.current.push(e.data);
          // 累積音声をSTTに送信（差分をonTranscriptへ）
          sendCumulativeToSTT();
        }
      };

      recorder.onstart = () => {
        phaseRef.current = "listening";
        setState((s) => ({ ...s, phase: "listening", isConnected: true }));
      };

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        sessionIdRef.current++; // 録音終了後にインクリメント → 進行中STTを無効化
        chunksRef.current = [];
        prevFullTranscriptRef.current = "";
        processingRef.current = false;
        phaseRef.current = "disconnected";
        setState({
          phase: "disconnected",
          isConnected: false,
          userTranscript: "",
          error: null,
          lastSTTDebug: null,
        });
        mediaRecorderRef.current = null;
      };

      recorder.onerror = () => {
        setState((s) => ({ ...s, error: "録音エラーが発生しました。" }));
      };

      recorder.start(CHUNK_INTERVAL_MS);
    } catch (err: any) {
      phaseRef.current = "disconnected";
      const errorMessage =
        err.name === "NotAllowedError"
          ? "マイクへのアクセスが拒否されました。ブラウザまたは端末の設定でマイクを許可してください。"
          : `マイクエラー: ${err.message}`;
      setState({
        phase: "disconnected",
        isConnected: false,
        userTranscript: "",
        error: errorMessage,
        lastSTTDebug: null,
      });
    }
  }, [sendCumulativeToSTT]);

  const disconnect = useCallback(() => {
    if (phaseRef.current === "disconnected") return;

    phaseRef.current = "processing";
    setState((s) => ({ ...s, phase: "processing", isConnected: false }));

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    speakText: async () => {},
    playBlob: async () => {},
    enqueueTTS: () => {},
    waitForQueueDrain: () => Promise.resolve(),
    clearTTSQueue: () => {},
    interrupt: () => {},
    startListening: () => {},
    stopListening: () => {},
  };
}

export { useVoice3Layer as useRealtimeVoice };
