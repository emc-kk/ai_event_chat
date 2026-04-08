/**
 * デモ用インメモリPBMステートマシン
 *
 * 本番の pbm-state-machine.ts と同じインターフェースを提供するが、
 * DBではなくインメモリ(Map)で状態を管理する。
 * 8ステップ対応、遷移条件は簡略化。
 *
 * v4.0: 統一ClientConfig + 矛盾/飽和のインメモリストア追加
 */

import { parseAndStripMeta } from "./pbm-state-machine";
import type {
  StepState,
  StepSignals,
  HearingMeta,
  HearingExtract,
} from "./pbm-state-machine";
import { loadClientConfig } from "./client-config";
import type { ClientConfig } from "./client-config";

// Re-export types and parseAndStripMeta
export { parseAndStripMeta };
export type { StepState, StepSignals, HearingMeta, HearingExtract };

// --- Load Config (統一ClientConfig経由) ---

let cachedConfig: ClientConfig | null = null;
let cachedSuntoryConfig: ClientConfig | null = null;

export function loadDaiwaConfig(): ClientConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = loadClientConfig('demo', 'daiwa_ei');
  return cachedConfig;
}

export function loadSuntoryConfig(): ClientConfig {
  if (cachedSuntoryConfig) return cachedSuntoryConfig;
  cachedSuntoryConfig = loadClientConfig('demo', 'suntory_azusa');
  return cachedSuntoryConfig;
}

// --- In-Memory State Store ---

const stateStore = new Map<string, StepState>();
const extractStore = new Map<string, HearingExtract[]>();
const layerCoverageStore = new Map<string, Record<number, number>>();
const biasStore = new Map<
  string,
  { type: string; text: string; status: string; messageCount: number }[]
>();
const messageCountStore = new Map<string, number>();

// v4.0: 矛盾検出用インメモリストア
const contradictionStore = new Map<
  string,
  Array<{
    type: string;
    contentA: string;
    contentB: string;
    similarity: number;
    confirmationQuestion: string;
    status: 'pending' | 'confirmed' | 'dismissed';
  }>
>();

// v4.0: 飽和度用インメモリストア
import type { SaturationState } from "./saturation-engine";
import { createInitialSaturationState } from "./saturation-engine";

const saturationStateStore = new Map<string, SaturationState>();
const embeddingCacheStore = new Map<string, Array<{ content: string; embedding: number[] }>>();

// --- Core Functions ---

export function demoGetOrCreateStepState(requestId: string): StepState {
  const existing = stateStore.get(requestId);
  if (existing) return existing;

  const initial: StepState = {
    currentStep: 0,
    currentStepStatus: "active",
    stepCompletion: {},
    extractedKnowledge: {},
  };
  stateStore.set(requestId, initial);
  layerCoverageStore.set(requestId, {});
  biasStore.set(requestId, []);
  messageCountStore.set(requestId, 0);
  contradictionStore.set(requestId, []);
  saturationStateStore.set(requestId, createInitialSaturationState());
  embeddingCacheStore.set(requestId, []);
  return initial;
}

export function demoEvaluateStepTransition(
  requestId: string,
  state: StepState,
  signals: StepSignals,
  configOverride?: ClientConfig
): StepState {
  const config = configOverride || loadDaiwaConfig();
  const totalSteps = config.pbm_config.total_steps;
  let shouldAdvance = false;
  let reason = "";

  // Accumulate premises
  if (signals.premises_confirmed && signals.premises_confirmed.length > 0) {
    const existing = state.extractedKnowledge["premises"] || [];
    const newPremises = signals.premises_confirmed.filter(
      (p) => !existing.includes(p)
    );
    if (newPremises.length > 0) {
      state = {
        ...state,
        extractedKnowledge: {
          ...state.extractedKnowledge,
          premises: [...existing, ...newPremises],
        },
      };
    }
  }

  // Simplified transition conditions for demo
  const step = state.currentStep;
  switch (step) {
    case 0: // Screen - Hard NG
      if (signals.no_dealbreakers === true) {
        shouldAdvance = true;
        reason = "No dealbreakers found";
      }
      break;
    case 1: { // Identify the Problem
      const premises = state.extractedKnowledge["premises"] || [];
      if (premises.length >= 3) {
        shouldAdvance = true;
        reason = `${premises.length} issues identified`;
      }
      break;
    }
    case 2: // Gather Information
    case 3: // Analyze the Situation
    case 4: // Develop Alternatives
      if (signals.coverage_score !== undefined && signals.coverage_score >= 0.4) {
        shouldAdvance = true;
        reason = `Coverage: ${signals.coverage_score}`;
      }
      break;
    case 5: // Evaluate Alternatives
      if (signals.coverage_score !== undefined && signals.coverage_score >= 0.6) {
        shouldAdvance = true;
        reason = `Coverage: ${signals.coverage_score}`;
      }
      break;
    case 6: // Select & Decide
      if (signals.coverage_score !== undefined && signals.coverage_score >= 0.7) {
        shouldAdvance = true;
        reason = `Conclusion formed`;
      }
      break;
    case 7: // Monitor & Review
      if (signals.coverage_score !== undefined && signals.coverage_score >= 0.8) {
        shouldAdvance = true;
        reason = `Review completed`;
      }
      break;
  }

  if (shouldAdvance && step < totalSteps - 1) {
    const newStep = step + 1;
    const newCompletion = {
      ...state.stepCompletion,
      [step]: {
        completed: true,
        completedAt: new Date().toISOString(),
        reason,
      },
    };
    const newState: StepState = {
      ...state,
      currentStep: newStep,
      currentStepStatus: "active",
      stepCompletion: newCompletion,
    };
    stateStore.set(requestId, newState);
    console.log(`[DemoPBM] Step ${step} → ${newStep}: ${reason}`);
    return newState;
  } else if (shouldAdvance && step === totalSteps - 1) {
    const newCompletion = {
      ...state.stepCompletion,
      [step]: {
        completed: true,
        completedAt: new Date().toISOString(),
        reason,
      },
    };
    const newState: StepState = {
      ...state,
      currentStepStatus: "completed",
      stepCompletion: newCompletion,
    };
    stateStore.set(requestId, newState);
    console.log(`[DemoPBM] All ${totalSteps} steps completed`);
    return newState;
  }

  stateStore.set(requestId, state);
  return state;
}

// 4-6: Accept requestId as argument instead of searching by object reference
export function demoGetStepContext(requestId: string, state: StepState, configOverride?: ClientConfig): string {
  const config = configOverride || loadDaiwaConfig();
  const stepConfig = config.pbm_config.steps.find(
    (s) => s.step === state.currentStep
  );
  if (!stepConfig) return "";

  let context = stepConfig.context;

  // Insert confirmed premises for step 1
  if (state.currentStep === 1) {
    const premises = state.extractedKnowledge["premises"] || [];
    const premisesText =
      premises.length > 0
        ? `確認済み論点: ${premises.map((p, i) => `${i + 1}. ${p}`).join(", ")}`
        : "確認済み論点: まだなし";
    context = context.replace("{confirmed_premises}", premisesText);
  }

  // Add layer coverage (4-6: use requestId directly, no reference search)
  if (requestId) {
    const coverage = layerCoverageStore.get(requestId) || {};
    const layerNames = ["原則", "判断基準", "リスク構造", "案件事実", "判断プロセス"];
    const coverageLines = layerNames.map((name, i) => {
      const count = coverage[i] || 0;
      return `  - Layer ${i} (${name}): ${count}件`;
    });
    const uncovered = layerNames
      .map((name, i) => ({ name, index: i, count: coverage[i] || 0 }))
      .filter((l) => l.count === 0)
      .map((l) => `Layer ${l.index} (${l.name})`);

    context += `\n\n## レイヤーカバレッジ状況\n${coverageLines.join("\n")}`;
    if (uncovered.length > 0) {
      context += `\n\n未カバーレイヤー: ${uncovered.join(", ")}\nこれらのレイヤーに関する質問を優先してください。`;
    }
  }

  return context;
}

export function demoSaveExtracts(
  requestId: string,
  extracts: HearingExtract[]
): void {
  const existing = extractStore.get(requestId) || [];
  extractStore.set(requestId, [...existing, ...extracts]);
  console.log(`[DemoPBM] Saved ${extracts.length} extracts`);
}

export function demoGetExtracts(requestId: string): HearingExtract[] {
  return extractStore.get(requestId) || [];
}

export function demoUpdateLayerCoverage(
  requestId: string,
  extracts: HearingExtract[]
): Record<number, number> {
  const current = layerCoverageStore.get(requestId) || {};
  for (const extract of extracts) {
    current[extract.layer] = (current[extract.layer] || 0) + 1;
  }
  layerCoverageStore.set(requestId, current);
  console.log(`[DemoPBM] Updated layer coverage:`, current);
  return current;
}

export function demoGetLayerCoverage(requestId: string): Record<number, number> {
  return layerCoverageStore.get(requestId) || {};
}

// --- Demo Bias Detection (in-memory) ---

export function demoDetectBiasPatterns(
  userMessage: string,
  configOverride?: ClientConfig
): { biasType: string; matchedText: string; socraticTemplate: string }[] {
  const config = configOverride || loadDaiwaConfig();
  const detected: { biasType: string; matchedText: string; socraticTemplate: string }[] = [];

  for (const biasType of config.bias_config.enabled_biases) {
    const patterns = config.bias_config.patterns[biasType] || [];
    for (const pat of patterns) {
      if (userMessage.includes(pat)) {
        detected.push({
          biasType,
          matchedText: pat,
          socraticTemplate: config.bias_config.socratic_templates[biasType] || "",
        });
        break; // One match per bias type is enough
      }
    }
  }

  return detected;
}

export function demoSaveBiasFlags(
  requestId: string,
  biases: { biasType: string; matchedText: string }[]
): void {
  const existing = biasStore.get(requestId) || [];
  const count = messageCountStore.get(requestId) || 0;
  for (const b of biases) {
    existing.push({
      type: b.biasType,
      text: b.matchedText,
      status: "pending",
      messageCount: count,
    });
  }
  biasStore.set(requestId, existing);
}

export function demoGetBiasAlerts(requestId: string, configOverride?: ClientConfig): string {
  const config = configOverride || loadDaiwaConfig();
  const flags = biasStore.get(requestId) || [];
  const count = messageCountStore.get(requestId) || 0;

  // Check timing rules
  const injectedCount = flags.filter((f) => f.status === "injected").length;
  if (injectedCount >= config.bias_config.max_per_session) return "";

  const lastInjected = flags.filter((f) => f.status === "injected").pop();
  if (lastInjected && count - lastInjected.messageCount < config.bias_config.min_interval) {
    return "";
  }

  const pending = flags.filter((f) => f.status === "pending");
  if (pending.length === 0) return "";

  const flag = pending[0];
  const template = config.bias_config.socratic_templates[flag.type] || "";

  const BIAS_LABELS: Record<string, string> = {
    optimism: "楽観バイアス",
    confirmation: "確証バイアス",
    sunk_cost: "サンクコスト",
    authority: "権威バイアス",
    overconfidence: "過信バイアス",
    anchoring: "アンカリング",
    recency: "近時バイアス",
    groupthink: "集団思考",
    normality_bias: "正常性バイアス",
    halo_effect: "ハロー効果",
  };

  return `## バイアス検出アラート
以下のバイアスの可能性が検出されました。自然な会話の中で、適切なタイミングで確認の質問を挿入してください。
即座に問い詰めるのではなく、話題の区切りで自然に問いかけてください。
1回の応答で対応するバイアスは1つまでにしてください。

- 「${flag.text}」→ ${BIAS_LABELS[flag.type] || flag.type}の可能性。
  ソクラテス式質問例: ${template}

バイアス確認の質問を行った場合は、HEARING_META の step_signals に "bias_addressed": true を含めてください。`;
}

export function demoMarkBiasesAsInjected(requestId: string): void {
  const flags = biasStore.get(requestId) || [];
  for (const f of flags) {
    if (f.status === "pending") {
      f.status = "injected";
    }
  }
}

export function demoIncrementMessageCount(requestId: string): void {
  const count = messageCountStore.get(requestId) || 0;
  messageCountStore.set(requestId, count + 1);
}

// --- v4.0: 矛盾検出 インメモリ ---

export function demoSaveContradiction(
  requestId: string,
  contradiction: {
    contentA: string;
    contentB: string;
    similarity: number;
    confirmationQuestion: string;
  }
): void {
  const existing = contradictionStore.get(requestId) || [];
  existing.push({
    type: 'session_internal',
    contentA: contradiction.contentA,
    contentB: contradiction.contentB,
    similarity: contradiction.similarity,
    confirmationQuestion: contradiction.confirmationQuestion,
    status: 'pending',
  });
  contradictionStore.set(requestId, existing);
  console.log(`[DemoPBM] Saved contradiction flag (similarity: ${contradiction.similarity.toFixed(2)})`);
}

export function demoGetPendingContradictions(requestId: string): string {
  const flags = contradictionStore.get(requestId) || [];
  const pending = flags.filter((f) => f.status === 'pending');

  // 5-1: Auto-dismiss old contradictions to prevent prompt bloat
  // Keep only the 2 most recent pending; dismiss the rest
  if (pending.length > 2) {
    const toKeep = pending.slice(-2);
    const toDismiss = pending.slice(0, -2);
    for (const f of toDismiss) {
      f.status = 'dismissed';
    }
    if (toKeep.length === 0) return '';
    return `## 矛盾検出アラート
以下の発言に矛盾の可能性が検出されました。自然な会話の流れの中で、確認の質問を行ってください。

${toKeep.map((f) => `- ${f.confirmationQuestion}`).join('\n')}`;
  }

  if (pending.length === 0) return '';

  return `## 矛盾検出アラート
以下の発言に矛盾の可能性が検出されました。自然な会話の流れの中で、確認の質問を行ってください。

${pending.map((f) => `- ${f.confirmationQuestion}`).join('\n')}`;
}

export function demoMarkContradictionsAsConfirmed(requestId: string): void {
  const flags = contradictionStore.get(requestId) || [];
  for (const f of flags) {
    if (f.status === 'pending') {
      f.status = 'confirmed';
    }
  }
}

// --- v4.0: 飽和度 インメモリ ---

export function demoGetSaturationState(requestId: string): SaturationState {
  return saturationStateStore.get(requestId) || createInitialSaturationState();
}

export function demoSetSaturationState(requestId: string, state: SaturationState): void {
  saturationStateStore.set(requestId, state);
}

export function demoGetEmbeddingCache(requestId: string): Array<{ content: string; embedding: number[] }> {
  return embeddingCacheStore.get(requestId) || [];
}

export function demoAddToEmbeddingCache(requestId: string, content: string, embedding: number[]): void {
  const cache = embeddingCacheStore.get(requestId) || [];
  cache.push({ content, embedding });
  embeddingCacheStore.set(requestId, cache);
}

/**
 * Get the current step number for a given request (for UI polling)
 */
export function demoGetCurrentStep(requestId: string): number {
  return stateStore.get(requestId)?.currentStep ?? 0;
}

/**
 * 7-1: Reset all in-memory state for a given session.
 * Prevents unbounded memory growth on long-running servers.
 */
export function demoResetSession(requestId: string): void {
  stateStore.delete(requestId);
  extractStore.delete(requestId);
  layerCoverageStore.delete(requestId);
  biasStore.delete(requestId);
  messageCountStore.delete(requestId);
  contradictionStore.delete(requestId);
  saturationStateStore.delete(requestId);
  embeddingCacheStore.delete(requestId);
  console.log(`[DemoPBM] Session reset: ${requestId}`);
}
