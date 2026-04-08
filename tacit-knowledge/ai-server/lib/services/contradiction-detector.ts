/**
 * 矛盾検出エンジン（v4.0 新規）
 *
 * バイアス検出（認知の歪み）とは別エンジン。知識の不整合を検出する。
 *
 * Phase 1 実装: セッション内矛盾（session_internal）のみ
 *   - 同じセッションで前後で異なることを言った場合にリアルタイム検出
 *   - 検出方法: 抽出済みcontentとのembedding類似度 + 否定パターン判定
 *   - 対応: 確認質問をプロンプトに挿入
 *
 * 将来Phase:
 *   - personal_internal: 過去セッションとの矛盾
 *   - expert_cross: エキスパート間の矛盾（バッチ）
 *   - rule_practice: ルールと実践の矛盾（バッチ）
 */

import { getTextEmbedding, cosineSimilarity } from './embedding-service'
import type { ContradictionConfig } from './client-config'

// --- Types ---

export interface ContradictionResult {
  found: boolean
  previousContent: string
  newContent: string
  similarity: number
  confirmationQuestion: string
}

export interface CachedExtract {
  content: string
  embedding?: number[]
}

// --- Session-Internal Contradiction Detection ---

/**
 * セッション内矛盾を検出する。
 * 新しい抽出内容を、同一セッション内の過去の抽出物と比較する。
 *
 * 検出ロジック:
 * 1. 新抽出のembeddingを取得
 * 2. 過去の抽出物との類似度を計算
 * 3. 高類似度（同じトピック）かつ否定パターン検出 → 矛盾の可能性
 */
export async function detectSessionContradictions(
  newExtractContent: string,
  previousExtracts: CachedExtract[],
  config: ContradictionConfig
): Promise<ContradictionResult | null> {
  if (!config.enabled_types.includes('session_internal')) return null
  if (previousExtracts.length === 0) return null

  try {
    const newEmbedding = await getTextEmbedding(newExtractContent)

    for (const prev of previousExtracts) {
      const prevEmbedding = prev.embedding || await getTextEmbedding(prev.content)

      const sim = cosineSimilarity(newEmbedding, prevEmbedding)

      // 高類似度（同じトピックに言及）かつ否定パターン → 矛盾の可能性
      if (sim >= config.similarity_threshold && hasNegationPattern(newExtractContent, prev.content)) {
        const question = config.confirmation_template
          .replace('{previous_content}', truncate(prev.content, 50))

        return {
          found: true,
          previousContent: prev.content,
          newContent: newExtractContent,
          similarity: sim,
          confirmationQuestion: question,
        }
      }
    }
  } catch (err) {
    console.error('[ContradictionDetector] Error during detection:', err)
  }

  return null
}

/**
 * 日本語テキスト間の否定パターンを検出する。
 * 意味的に類似しているが結論が逆の場合に true を返す。
 */
function hasNegationPattern(textA: string, textB: string): boolean {
  const negationMarkers = [
    /ではない/,
    /ない$/,
    /しない/,
    /できない/,
    /むしろ/,
    /逆に/,
    /一方/,
    /ただし/,
    /反対に/,
    /異なる/,
    /違う/,
    /ではなく/,
    /というわけではない/,
    /とは限らない/,
  ]

  // 片方にのみ否定マーカーがある場合、矛盾の可能性
  return negationMarkers.some((marker) =>
    (marker.test(textA) && !marker.test(textB)) ||
    (!marker.test(textA) && marker.test(textB))
  )
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.substring(0, maxLen) + '...'
}

// --- プロンプトフラグメント生成 ---

/**
 * 矛盾検出結果からプロンプトに挿入する確認質問テキストを生成する。
 */
export function buildContradictionAlertFragment(
  contradictions: ContradictionResult[]
): string {
  if (contradictions.length === 0) return ''

  const alerts = contradictions.map((c) => {
    const prevShort = truncate(c.previousContent, 40)
    return `- 先ほど「${prevShort}」とおっしゃいましたが、今回の「${truncate(c.newContent, 40)}」と整合しない可能性があります。\n  確認質問: ${c.confirmationQuestion}`
  })

  return `## 矛盾検出アラート
以下の発言に矛盾の可能性が検出されました。自然な会話の流れの中で、確認の質問を行ってください。
問い詰めるのではなく、「考えが変わったのか」「条件が異なるのか」を穏やかに確認してください。

${alerts.join('\n')}`
}
