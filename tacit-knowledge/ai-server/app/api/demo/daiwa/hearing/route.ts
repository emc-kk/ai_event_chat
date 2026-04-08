import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import type { AgentExecutionOptions } from "@mastra/core/agent";
import { RequestContext } from "@mastra/core/request-context";
import { nanoid } from "nanoid";
import { mastra } from "@/lib/mastra";
import { getDemoHearingInitialPrompt } from "@/lib/mastra/agents/demo-hearing-agent";
import { clearGeneratedSuggestions } from "@/lib/mastra/tools/send-suggestions-tool";
import type { RequestData } from "@/lib/types";
import {
  loadDaiwaConfig,
  demoGetOrCreateStepState,
  demoGetStepContext,
  demoEvaluateStepTransition,
  demoDetectBiasPatterns,
  demoSaveBiasFlags,
  demoGetBiasAlerts,
  demoMarkBiasesAsInjected,
  demoIncrementMessageCount,
  demoSaveExtracts,
  demoUpdateLayerCoverage,
  demoGetLayerCoverage,
  demoGetExtracts,
  demoGetCurrentStep,
  demoSaveContradiction,
  demoGetPendingContradictions,
  demoGetSaturationState,
  demoSetSaturationState,
  demoGetEmbeddingCache,
  demoAddToEmbeddingCache,
  parseAndStripMeta,
} from "@/lib/services/demo-pbm-state-machine";
import { selectElicitationMethod, buildElicitationPromptFragment } from "@/lib/services/elicitation-method";
import { detectSessionContradictions } from "@/lib/services/contradiction-detector";
import type { CachedExtract } from "@/lib/services/contradiction-detector";
import { buildCoverageMap, buildSaturationPromptFragment, calculateNoveltyScore, updateSaturationState } from "@/lib/services/saturation-engine";
import { getTextEmbedding } from "@/lib/services/embedding-service";

const DEMO_REQUEST_ID = "demo-daiwa-001";

interface MockRequestData {
  id: string;
  name: string;
  description: string;
  context: string;
  topicId: string;
  topicName: string;
  topicDescription: string;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const config = loadDaiwaConfig();
  const mock = config.mock_request_data as MockRequestData;
  const mockRequestData: RequestData = {
    id: mock.id,
    name: mock.name,
    description: mock.description,
    context: mock.context,
    topicId: mock.topicId,
    topicName: mock.topicName,
    topicDescription: mock.topicDescription,
  };

  clearGeneratedSuggestions(DEMO_REQUEST_ID);

  const INITIAL_MESSAGE_MARKER = "__INITIAL_MESSAGE__";
  let userMessage = "";
  let isInitialMessage = false;

  if (messages && messages.length > 0) {
    const modelMessages = await convertToModelMessages(messages);
    const lastMessageContent = modelMessages[modelMessages.length - 1].content;
    if (Array.isArray(lastMessageContent)) {
      for (const part of lastMessageContent) {
        if (part.type === "text") {
          userMessage = part.text || "";
        }
      }
    }
  }

  if (userMessage === INITIAL_MESSAGE_MARKER || !userMessage) {
    isInitialMessage = true;
    userMessage = getDemoHearingInitialPrompt();
  }

  // --- Demo PBM: in-memory state ---
  const stepState = demoGetOrCreateStepState(DEMO_REQUEST_ID);
  const pbmStepContext = demoGetStepContext(DEMO_REQUEST_ID, stepState);

  // --- v4.0: 引き出し手法選択 ---
  const currentStepConfig = config.pbm_config.steps.find((s) => s.step === stepState.currentStep);
  const layerCoverage = demoGetLayerCoverage(DEMO_REQUEST_ID);
  const elicitation = selectElicitationMethod(
    config.elicitation_config,
    stepState.currentStep,
    layerCoverage,
    currentStepConfig?.target_layers || []
  );
  const elicitationMethodInstruction = buildElicitationPromptFragment(elicitation.primary, elicitation.secondary);

  // --- v4.0: 矛盾検出アラート（前ターンでflush時に保存されたもの） ---
  const contradictionAlerts = demoGetPendingContradictions(DEMO_REQUEST_ID);

  // --- v4.0: 飽和度情報 ---
  let saturationInfo = '';
  try {
    const extracts = demoGetExtracts(DEMO_REQUEST_ID);
    const coverageMap = buildCoverageMap(
      extracts.map((e) => ({ layer: e.layer, risk_axis: e.risk_axis || undefined }))
    );
    const satState = demoGetSaturationState(DEMO_REQUEST_ID);
    saturationInfo = buildSaturationPromptFragment(coverageMap, satState.saturatedLayers);
  } catch {
    // 飽和度計算失敗は非致命的
  }

  // --- Bias detection (pattern match, in-memory) ---
  if (userMessage && !isInitialMessage) {
    demoIncrementMessageCount(DEMO_REQUEST_ID);
    const detected = demoDetectBiasPatterns(userMessage);
    if (detected.length > 0) {
      demoSaveBiasFlags(
        DEMO_REQUEST_ID,
        detected.map((d) => ({ biasType: d.biasType, matchedText: d.matchedText }))
      );
    }
  }

  // --- Bias alerts for prompt injection ---
  const biasAlerts = demoGetBiasAlerts(DEMO_REQUEST_ID);

  // --- RequestContext（v4.0: 3フィールド追加） ---
  const requestContext = new RequestContext<{
    requestData: RequestData;
    requestId: string;
    pbmStepContext: string;
    biasAlerts: string;
    elicitationMethodInstruction: string;
    contradictionAlerts: string;
    saturationInfo: string;
  }>();
  requestContext.set("requestData", mockRequestData);
  requestContext.set("requestId", DEMO_REQUEST_ID);
  requestContext.set("pbmStepContext", pbmStepContext);
  requestContext.set("biasAlerts", biasAlerts);
  requestContext.set("elicitationMethodInstruction", elicitationMethodInstruction);
  requestContext.set("contradictionAlerts", contradictionAlerts);
  requestContext.set("saturationInfo", saturationInfo);

  const inputMessages: UIMessage[] = [
    {
      id: nanoid(),
      role: "user",
      parts: [{ type: "text" as const, text: userMessage }],
    },
  ];

  const threadId = `demo-hearing-${DEMO_REQUEST_ID}`;

  const stream = await handleChatStream({
    mastra,
    agentId: "demoHearingAgent",
    params: {
      messages: inputMessages,
      memory: {
        thread: threadId,
        resource: DEMO_REQUEST_ID,
      },
      providerOptions: {
        openai: {
          reasoningEffort: "low",
          reasoningSummary: "auto",
        },
      },
    },
    defaultOptions: {
      requestContext,
    } as AgentExecutionOptions,
    sendReasoning: true,
  });

  // --- Stream transform: parse HEARING_META + update in-memory state + v4.0フレームワーク処理 ---
  let assistantResponse = "";
  const transformStream = new TransformStream({
    transform(chunk, controller) {
      if (chunk && typeof chunk === "object") {
        const parsed = chunk as {
          type?: string;
          delta?: string;
          text?: string;
        };
        if (parsed.type === "text-delta" && parsed.delta) {
          assistantResponse += parsed.delta;
        } else if (parsed.type === "text" && parsed.text) {
          assistantResponse += parsed.text;
        }
      }
      controller.enqueue(chunk);
    },
    async flush() {
      if (!assistantResponse) return;

      const { meta } = parseAndStripMeta(assistantResponse);

      if (meta) {
        try {
          if (meta.extracts && meta.extracts.length > 0) {
            demoSaveExtracts(DEMO_REQUEST_ID, meta.extracts);
            demoUpdateLayerCoverage(DEMO_REQUEST_ID, meta.extracts);

            // v4.0: 矛盾検出（セッション内）
            try {
              const previousExtracts = demoGetExtracts(DEMO_REQUEST_ID);
              // 直前にsaveした分を除いた以前の抽出物
              const previousOnly = previousExtracts.slice(0, -meta.extracts.length);
              const cachedExtracts: CachedExtract[] = previousOnly.map((e) => ({ content: e.content }));

              for (const extract of meta.extracts) {
                const contradiction = await detectSessionContradictions(
                  extract.content,
                  cachedExtracts,
                  config.contradiction_config
                );
                if (contradiction) {
                  demoSaveContradiction(DEMO_REQUEST_ID, {
                    contentA: contradiction.previousContent,
                    contentB: contradiction.newContent,
                    similarity: contradiction.similarity,
                    confirmationQuestion: contradiction.confirmationQuestion,
                  });
                }
              }
            } catch (contradictionErr) {
              console.error('[Demo Hearing] Contradiction detection error:', contradictionErr);
            }

            // v4.0: 飽和度更新
            try {
              const existingEmbeddings = demoGetEmbeddingCache(DEMO_REQUEST_ID);
              let satState = demoGetSaturationState(DEMO_REQUEST_ID);

              for (const extract of meta.extracts) {
                const novelty = await calculateNoveltyScore(extract.content, existingEmbeddings);
                satState = updateSaturationState(satState, extract.layer, novelty.score, config.saturation_config);

                // embeddingキャッシュに追加（次ターンの飽和度計算用）
                try {
                  const emb = await getTextEmbedding(extract.content);
                  demoAddToEmbeddingCache(DEMO_REQUEST_ID, extract.content, emb);
                } catch { /* skip embedding cache on failure */ }
              }

              demoSetSaturationState(DEMO_REQUEST_ID, satState);
            } catch (saturationErr) {
              console.error('[Demo Hearing] Saturation update error:', saturationErr);
            }
          }

          if (meta.step_signals) {
            demoEvaluateStepTransition(
              DEMO_REQUEST_ID,
              demoGetOrCreateStepState(DEMO_REQUEST_ID),
              meta.step_signals
            );

            if (meta.step_signals.bias_addressed) {
              demoMarkBiasesAsInjected(DEMO_REQUEST_ID);
            }
          }
        } catch (err) {
          console.error("[Demo Hearing] Failed to process HEARING_META:", err);
        }
      }
    },
  });

  const outputStream = stream.pipeThrough(transformStream);
  return createUIMessageStreamResponse({ stream: outputStream });
}

// --- GET endpoint for current step (polled by UI) ---
export async function GET() {
  const step = demoGetCurrentStep(DEMO_REQUEST_ID);
  return Response.json({ step });
}
