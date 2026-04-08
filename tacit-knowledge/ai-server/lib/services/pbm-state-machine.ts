/**
 * PBM (Process-Based Management) ステートマシン
 *
 * ヒアリングの進行を3ステップで管理する。
 * LLM に判断を委ねず、LLM の構造化出力(HEARING_META)をパースし、
 * プログラム側でステップ遷移を制御する。
 *
 * Step 0: Hard NG 排除 - 致命的な問題がないか確認
 * Step 1: 前提確認     - 判断の前提条件を検証（3つ以上の前提を確認）
 * Step 2: 定量・定性評価 - データに基づく深掘り
 */

import { query } from './database-service'
import { ulid } from 'ulid'

// --- Types ---

export interface HearingMeta {
  step: number
  extracts: HearingExtract[]
  step_signals: StepSignals
}

export interface HearingExtract {
  layer: number
  content: string
  hypothesis?: string
  risk_axis?: string
  data_4type?: string
  data_source?: string
  verification_requirement?: string
  // v4.0 新規フィールド
  knowledge_form?: string          // 知識粒度: explicit_rule|heuristic|pattern|conditional|tradeoff
  elicitation_method?: string      // 引き出し手法: cdm|contrast|boundary|hypothetical|exception
  context_conditions?: Array<{ condition: string; override: string }>  // 文脈条件
  applicability_scope?: string     // 適用範囲
  temporal_validity?: string       // 時間的有効性
}

export interface StepSignals {
  no_dealbreakers?: boolean
  dealbreaker_found?: string
  premises_confirmed?: string[]
  coverage_score?: number
  bias_addressed?: boolean
  deduction?: string
  addition?: string
  conditional?: string
  layer_coverage?: Record<number, number>
}

export interface StepState {
  currentStep: number
  currentStepStatus: 'active' | 'completed'
  stepCompletion: Record<string, StepCompletionInfo>
  extractedKnowledge: Record<string, string[]>
}

interface StepCompletionInfo {
  completed: boolean
  completedAt?: string
  reason?: string
}

// --- Step Context for Prompt ---

const STEP_CONTEXTS: Record<number, string> = {
  0: `## 現在の PBM ステップ: Step 0 - Hard NG 排除

現在はHard NG排除フェーズです。
この案件/テーマについて、致命的な問題や即座に排除すべき要因がないか確認してください。

以下の観点で確認します：
- 法令・規制上の問題はないか
- 倫理的・コンプライアンス上の致命的な問題はないか
- 技術的に実現不可能な要件はないか
- 組織として絶対に受け入れられない条件はないか

致命的な問題がなければ、次のステップ（前提確認）に進みます。`,

  1: `## 現在の PBM ステップ: Step 1 - 前提確認

現在は前提確認フェーズです。
この判断・業務の前提条件を検証してください。

以下の観点で前提を確認します：
- この判断の基礎となる前提条件は何か
- その前提は現在も有効か
- 暗黙の前提が隠れていないか
- 前提が崩れた場合のリスクは何か

{confirmed_premises}

最低3つの主要前提が確認できたら、次のステップ（定量・定性評価）に進みます。`,

  2: `## 現在の PBM ステップ: Step 2 - 定量・定性評価

現在は定量・定性評価フェーズです。
データに基づいて深掘りしてください。

以下の観点で評価します：
- 定量的な指標やデータに基づく判断
- 定性的な評価（経験則、暗黙知）
- トレードオフの分析
- リスクと機会のバランス

ヒアリング計画の仮説を十分にカバーしてください。`,
}

// --- Core Functions ---

/**
 * リクエストの現在のステップ状態を取得（なければ初期化）
 */
export async function getOrCreateStepState(requestId: string): Promise<StepState> {
  const rows = await query<{
    current_step: number
    current_step_status: string
    step_completion: Record<string, StepCompletionInfo>
    extracted_knowledge: Record<string, string[]>
  }>(
    `SELECT current_step, current_step_status, step_completion, extracted_knowledge
     FROM hearing_step_states WHERE request_id = $1 LIMIT 1`,
    [requestId]
  )

  if (rows.length > 0) {
    return {
      currentStep: rows[0].current_step,
      currentStepStatus: rows[0].current_step_status as 'active' | 'completed',
      stepCompletion: rows[0].step_completion || {},
      extractedKnowledge: rows[0].extracted_knowledge || {},
    }
  }

  // 初期化
  await query(
    `INSERT INTO hearing_step_states (id, request_id, current_step, current_step_status, step_completion, extracted_knowledge, layer_coverage, created_at, updated_at)
     VALUES ($1, $2, 0, 'active', '{}', '{}', '{}', NOW(), NOW())`,
    [ulid(), requestId]
  )

  return {
    currentStep: 0,
    currentStepStatus: 'active',
    stepCompletion: {},
    extractedKnowledge: {},
  }
}

/**
 * HEARING_META のステップシグナルに基づいてステップ遷移を判定・実行
 */
export async function evaluateStepTransition(
  requestId: string,
  state: StepState,
  signals: StepSignals
): Promise<StepState> {
  let shouldAdvance = false
  let reason = ''

  // Step 1: premises_confirmed を extracted_knowledge に蓄積（遷移前に毎回更新）
  if (state.currentStep === 1 && signals.premises_confirmed && signals.premises_confirmed.length > 0) {
    const existing = state.extractedKnowledge['premises'] || []
    const newPremises = signals.premises_confirmed.filter((p) => !existing.includes(p))
    if (newPremises.length > 0) {
      const updatedPremises = [...existing, ...newPremises]
      state = {
        ...state,
        extractedKnowledge: {
          ...state.extractedKnowledge,
          premises: updatedPremises,
        },
      }
      await query(
        `UPDATE hearing_step_states
         SET extracted_knowledge = $1, updated_at = NOW()
         WHERE request_id = $2`,
        [JSON.stringify(state.extractedKnowledge), requestId]
      )
    }
  }

  switch (state.currentStep) {
    case 0:
      // Step 0 完了条件: dealbreaker がないことが確認された
      if (signals.no_dealbreakers === true) {
        shouldAdvance = true
        reason = 'No dealbreakers found'
      } else if (signals.dealbreaker_found) {
        // Dealbreaker が見つかった場合はステップを進めない（ヒアリングは継続）
        console.log('[PBM] Dealbreaker found:', signals.dealbreaker_found)
      }
      break

    case 1: {
      // Step 1 完了条件: 蓄積された前提が3つ以上
      const allPremises = state.extractedKnowledge['premises'] || []
      if (allPremises.length >= 3) {
        shouldAdvance = true
        reason = `${allPremises.length} premises confirmed`
      }
      break
    }

    case 2:
      // Step 2 完了条件: カバレッジスコアが 0.8 以上
      if (signals.coverage_score !== undefined && signals.coverage_score >= 0.8) {
        shouldAdvance = true
        reason = `Coverage score: ${signals.coverage_score}`
      }
      break
  }

  if (shouldAdvance && state.currentStep < 2) {
    const newStep = state.currentStep + 1
    const newCompletion = {
      ...state.stepCompletion,
      [state.currentStep]: {
        completed: true,
        completedAt: new Date().toISOString(),
        reason,
      },
    }

    await query(
      `UPDATE hearing_step_states
       SET current_step = $1, current_step_status = 'active',
           step_completion = $2, updated_at = NOW()
       WHERE request_id = $3`,
      [newStep, JSON.stringify(newCompletion), requestId]
    )

    console.log(`[PBM] Step ${state.currentStep} → ${newStep}: ${reason}`)

    return {
      ...state,
      currentStep: newStep,
      currentStepStatus: 'active',
      stepCompletion: newCompletion,
    }
  } else if (shouldAdvance && state.currentStep === 2) {
    // 最終ステップ完了
    const newCompletion = {
      ...state.stepCompletion,
      [state.currentStep]: {
        completed: true,
        completedAt: new Date().toISOString(),
        reason,
      },
    }

    await query(
      `UPDATE hearing_step_states
       SET current_step_status = 'completed',
           step_completion = $1, updated_at = NOW()
       WHERE request_id = $2`,
      [JSON.stringify(newCompletion), requestId]
    )

    console.log(`[PBM] All steps completed`)

    return {
      ...state,
      currentStepStatus: 'completed',
      stepCompletion: newCompletion,
    }
  }

  return state
}

/**
 * 現在のステップに応じたプロンプトコンテキストを生成
 */
export function getStepContext(state: StepState): string {
  const context = STEP_CONTEXTS[state.currentStep] || STEP_CONTEXTS[2]

  if (state.currentStep === 1) {
    // Step 1 では確認済み前提のリストを挿入
    const confirmedPremises = state.extractedKnowledge['premises'] || []
    const premisesText = confirmedPremises.length > 0
      ? `確認済み前提: ${confirmedPremises.map((p, i) => `${i + 1}. ${p}`).join(', ')}`
      : '確認済み前提: まだなし'
    return context.replace('{confirmed_premises}', premisesText)
  }

  return context
}

/**
 * レイヤーカバレッジ情報を含むステップコンテキストを生成（非同期版）
 */
export async function getStepContextWithCoverage(
  state: StepState,
  requestId: string
): Promise<string> {
  let context = getStepContext(state)

  // レイヤーカバレッジを取得
  const rows = await query<{ layer_coverage: Record<string, number> }>(
    `SELECT layer_coverage FROM hearing_step_states WHERE request_id = $1`,
    [requestId]
  )

  if (rows.length > 0 && rows[0].layer_coverage) {
    const coverage = rows[0].layer_coverage
    const layerNames = ['原則', '判断基準', 'リスク構造', '案件事実', '判断プロセス']
    const coverageLines = layerNames.map((name, i) => {
      const count = coverage[i.toString()] || 0
      return `  - Layer ${i} (${name}): ${count}件`
    })

    const uncoveredLayers = layerNames
      .map((name, i) => ({ name, index: i, count: coverage[i.toString()] || 0 }))
      .filter((l) => l.count === 0)
      .map((l) => `Layer ${l.index} (${l.name})`)

    context += `\n\n## レイヤーカバレッジ状況\n${coverageLines.join('\n')}`

    if (uncoveredLayers.length > 0) {
      context += `\n\n未カバーレイヤー: ${uncoveredLayers.join(', ')}\nこれらのレイヤーに関する質問を優先してください。`
    }
  }

  return context
}

/**
 * 抽出された知識を DB に保存
 */
export async function saveExtracts(
  requestId: string,
  messageId: string | undefined,
  pbmStep: number,
  extracts: HearingExtract[]
): Promise<void> {
  for (const extract of extracts) {
    await query(
      `INSERT INTO hearing_extracts (id, request_id, source_message_id, pbm_step, knowledge_layer, content, hypothesis, risk_axis, data_type, data_source, verification_requirement, knowledge_form, elicitation_method, context_conditions, applicability_scope, temporal_validity, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())`,
      [
        ulid(),
        requestId,
        messageId || null,
        pbmStep,
        extract.layer,
        extract.content,
        extract.hypothesis || null,
        extract.risk_axis || null,
        extract.data_4type || null,
        extract.data_source || null,
        extract.verification_requirement || null,
        extract.knowledge_form || null,
        extract.elicitation_method || null,
        extract.context_conditions ? JSON.stringify(extract.context_conditions) : null,
        extract.applicability_scope || null,
        extract.temporal_validity || null,
      ]
    )
  }
  console.log(`[PBM] Saved ${extracts.length} extracts for step ${pbmStep}`)
}

/**
 * レイヤーカバレッジを更新する
 */
export async function updateLayerCoverage(
  requestId: string,
  extracts: HearingExtract[]
): Promise<Record<number, number>> {
  // 現在のカバレッジを取得
  const rows = await query<{ layer_coverage: Record<string, number> }>(
    `SELECT layer_coverage FROM hearing_step_states WHERE request_id = $1`,
    [requestId]
  )

  const current: Record<number, number> = {}
  if (rows.length > 0 && rows[0].layer_coverage) {
    for (const [k, v] of Object.entries(rows[0].layer_coverage)) {
      current[parseInt(k)] = v
    }
  }

  // 各レイヤーのカウントをインクリメント
  for (const extract of extracts) {
    current[extract.layer] = (current[extract.layer] || 0) + 1
  }

  // 保存
  await query(
    `UPDATE hearing_step_states SET layer_coverage = $1, updated_at = NOW() WHERE request_id = $2`,
    [JSON.stringify(current), requestId]
  )

  console.log(`[PBM] Updated layer coverage:`, current)
  return current
}

/**
 * HEARING_META ブロックをレスポンステキストからパース・除去
 * ストリーミング完了後のフルテキストに対して実行する
 */
export function parseAndStripMeta(fullText: string): {
  cleanText: string
  meta: HearingMeta | null
} {
  const metaRegex = /<!--HEARING_META\s*([\s\S]*?)-->/
  const match = fullText.match(metaRegex)

  if (!match) {
    return { cleanText: fullText, meta: null }
  }

  try {
    const meta = JSON.parse(match[1].trim()) as HearingMeta
    const cleanText = fullText.replace(metaRegex, '').trim()
    return { cleanText, meta }
  } catch (e) {
    console.error('[PBM] Failed to parse HEARING_META:', e)
    const cleanText = fullText.replace(metaRegex, '').trim()
    return { cleanText, meta: null }
  }
}
