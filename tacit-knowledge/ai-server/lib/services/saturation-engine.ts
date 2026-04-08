/**
 * 飽和度フレームワーク（v4.0 新規）
 *
 * レイヤーカバレッジの量的基準に加え、質的な飽和を判定する。
 *
 * 3つの指標:
 * 1. 新規性スコア: 直近の抽出が既存KBとどの程度重複しているか（embedding類似度）
 *    0=完全新規、1=完全重複。高重複3回連続→そのレイヤーは飽和
 * 2. カバレッジマップ: 6リスク軸×5レイヤー=30セルの充足状況
 * 3. エキスパートカバレッジ: 同じチェック項目に何人のエキスパートから知識があるか（Phase 2以降）
 */

import { getTextEmbedding, cosineSimilarity } from './embedding-service'
import type { SaturationConfig } from './client-config'

// --- Types ---

export interface NoveltyResult {
  score: number          // 0=完全新規、1=完全重複
  isSaturated: boolean
  mostSimilarContent: string | null
}

export interface CoverageMap {
  cells: Record<string, number>  // key = `${risk_axis}:${layer}`, value = count
  gaps: Array<{ riskAxis: string; layer: number }>
  totalCoverage: number  // 0.0-1.0
}

export interface SaturationState {
  consecutiveHighOverlap: Record<number, number>  // layer -> consecutive count
  saturatedLayers: number[]
}

// --- Constants ---

const RISK_AXES = [
  'target_risk', 'structural_risk', 'external_risk',
  'operational_risk', 'concentration_risk', 'information_risk',
] as const

const RISK_AXIS_LABELS: Record<string, string> = {
  target_risk: '対象リスク',
  structural_risk: '構造リスク',
  external_risk: '外生リスク',
  operational_risk: '実行リスク',
  concentration_risk: '集中リスク',
  information_risk: '情報リスク',
}

const LAYER_LABELS = ['原則', '判断基準', 'リスク構造', '案件事実', '判断プロセス']
const LAYERS = [0, 1, 2, 3, 4] as const

// --- Novelty Score ---

/**
 * 新規性スコアを計算する。
 * 新しい抽出のembeddingと既存の全抽出のembeddingとの最大類似度を返す。
 */
export async function calculateNoveltyScore(
  newContent: string,
  existingEmbeddings: Array<{ content: string; embedding: number[] }>
): Promise<NoveltyResult> {
  if (existingEmbeddings.length === 0) {
    return { score: 0, isSaturated: false, mostSimilarContent: null }
  }

  try {
    const newEmbedding = await getTextEmbedding(newContent)

    let maxSimilarity = 0
    let mostSimilarContent: string | null = null

    for (const existing of existingEmbeddings) {
      const sim = cosineSimilarity(newEmbedding, existing.embedding)
      if (sim > maxSimilarity) {
        maxSimilarity = sim
        mostSimilarContent = existing.content
      }
    }

    return {
      score: maxSimilarity,
      isSaturated: false, // caller determines via updateSaturationState
      mostSimilarContent,
    }
  } catch (err) {
    console.error('[SaturationEngine] Error calculating novelty score:', err)
    return { score: 0, isSaturated: false, mostSimilarContent: null }
  }
}

// --- Coverage Map ---

/**
 * 6リスク軸×5レイヤー=30セルのカバレッジマップを構築する。
 */
export function buildCoverageMap(
  extracts: Array<{ layer: number; risk_axis?: string }>
): CoverageMap {
  const cells: Record<string, number> = {}
  const gaps: Array<{ riskAxis: string; layer: number }> = []

  // 全セルを0で初期化
  for (const axis of RISK_AXES) {
    for (const layer of LAYERS) {
      cells[`${axis}:${layer}`] = 0
    }
  }

  // 抽出物をカウント
  for (const extract of extracts) {
    if (extract.risk_axis) {
      const key = `${extract.risk_axis}:${extract.layer}`
      cells[key] = (cells[key] || 0) + 1
    }
  }

  // ギャップを特定
  for (const axis of RISK_AXES) {
    for (const layer of LAYERS) {
      if (cells[`${axis}:${layer}`] === 0) {
        gaps.push({ riskAxis: axis, layer })
      }
    }
  }

  const totalCells = RISK_AXES.length * LAYERS.length
  const filledCells = Object.values(cells).filter((v) => v > 0).length

  return {
    cells,
    gaps,
    totalCoverage: filledCells / totalCells,
  }
}

// --- Saturation State Management ---

/**
 * 飽和状態を更新する。
 * 同一レイヤーで高重複がN回連続した場合、そのレイヤーを飽和と判定。
 */
export function updateSaturationState(
  state: SaturationState,
  layer: number,
  noveltyScore: number,
  config: SaturationConfig
): SaturationState {
  const updated = {
    consecutiveHighOverlap: { ...state.consecutiveHighOverlap },
    saturatedLayers: [...state.saturatedLayers],
  }

  if (noveltyScore >= config.novelty_threshold) {
    // 高重複
    updated.consecutiveHighOverlap[layer] = (updated.consecutiveHighOverlap[layer] || 0) + 1
    if (updated.consecutiveHighOverlap[layer] >= config.consecutive_count) {
      if (!updated.saturatedLayers.includes(layer)) {
        updated.saturatedLayers.push(layer)
        console.log(`[SaturationEngine] Layer ${layer} (${LAYER_LABELS[layer]}) is saturated`)
      }
    }
  } else {
    // 新情報 → カウンタリセット
    updated.consecutiveHighOverlap[layer] = 0
  }

  return updated
}

/**
 * 初期飽和状態を生成する。
 */
export function createInitialSaturationState(): SaturationState {
  return {
    consecutiveHighOverlap: {},
    saturatedLayers: [],
  }
}

// --- プロンプトフラグメント生成 ---

/**
 * カバレッジマップと飽和情報からプロンプトに挿入するテキストを生成する。
 */
export function buildSaturationPromptFragment(
  coverageMap: CoverageMap,
  saturatedLayers: number[]
): string {
  if (coverageMap.gaps.length === 0 && saturatedLayers.length === 0) return ''

  const parts: string[] = []

  // カバレッジ情報
  parts.push(`## ナレッジカバレッジ状況（6軸×5層 = 30セル）`)
  parts.push(`全体カバレッジ: ${Math.round(coverageMap.totalCoverage * 100)}%`)

  // ギャップ（最大10件表示）
  if (coverageMap.gaps.length > 0) {
    const topGaps = coverageMap.gaps.slice(0, 10)
    const gapTexts = topGaps.map((g) => {
      const axisLabel = RISK_AXIS_LABELS[g.riskAxis] || g.riskAxis
      const layerLabel = LAYER_LABELS[g.layer] || `Layer${g.layer}`
      return `  - ${axisLabel} × ${layerLabel}`
    })
    parts.push(`\n未カバー領域（${coverageMap.gaps.length}セル）:`)
    parts.push(gapTexts.join('\n'))
    parts.push(`これらの領域に関する質問を優先してください。`)
  }

  // 飽和レイヤー
  if (saturatedLayers.length > 0) {
    const saturatedNames = saturatedLayers.map((l) => `Layer ${l} (${LAYER_LABELS[l]})`).join(', ')
    parts.push(`\n飽和レイヤー: ${saturatedNames}`)
    parts.push(`これらのレイヤーは十分な情報が蓄積されています。他のレイヤーに注力してください。`)
  }

  return parts.join('\n')
}
