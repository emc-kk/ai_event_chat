/**
 * 2段階バイアス検出器（v4.0: 10種マスター + config駆動）
 *
 * Stage 1: パターンマッチング（コスト0、遅延~1ms）
 *   ユーザーメッセージに対して正規表現ベースでバイアスパターンを検出。
 *   検出されたらDB に bias_flags を pending 状態で保存。
 *
 * Stage 2: LLM コンテキスト判定（Stage 1 でフラグが立った場合のみ）
 *   pending のバイアスフラグをプロンプトに注入し、LLM が自然な会話の中で
 *   適切なタイミングで補正質問を行う。
 *
 * v4.0変更:
 *   - 5種ハードコード → 10種マスターレジストリ
 *   - client_config.bias_config で有効バイアスを切替
 *   - 挿入制御パラメータ (max_per_session, min_interval, confidence_threshold) をconfigから取得
 */

import { query } from './database-service'
import { ulid } from 'ulid'
import type { BiasConfig } from './client-config'

// --- Types ---

export interface BiasPattern {
  pattern: RegExp
  type: string
  description: string
  correctionHint: string
  socraticTemplate: string
}

export interface DetectedBias {
  biasType: string
  originalText: string
  matchedText: string
  description: string
  correctionHint: string
}

export interface PendingBiasFlag {
  id: string
  bias_type: string
  original_text: string
  correction_question: string | null
  detection_stage: string
}

// --- 10種マスターレジストリ（仕様書準拠） ---

const MASTER_BIAS_REGISTRY: BiasPattern[] = [
  // 1. 楽観バイアス
  {
    pattern: /(?:だと思う|だろう|大丈夫|問題ない|うまくいく|心配ない)/,
    type: 'optimistic_assertion',
    description: '楽観的な断定表現',
    correctionHint: '根拠となるデータや過去の実績の有無を確認',
    socraticTemplate: 'もし最悪のケースが起きた場合、この見通しはどう変わりますか？',
  },
  // 2. 確証バイアス
  {
    pattern: /(?:前回も|いつも|毎回|必ず(?:うまく|成功)|今までも)/,
    type: 'confirmation_bias',
    description: '過去の成功体験への過度な依存',
    correctionHint: '前回と今回の条件の違い、失敗した事例の有無を確認',
    socraticTemplate: '逆に、この前提が当てはまらなかったケースはありますか？',
  },
  // 3. サンクコスト
  {
    pattern: /(?:ここまでやったから|せっかく|もう引き返せない|今さら|ここまで来たら)/,
    type: 'sunk_cost',
    description: '埋没コストへの固執',
    correctionHint: '過去の投資を度外視した場合の判断を確認',
    socraticTemplate: 'もし今日が初日だとして、同じ判断をしますか？',
  },
  // 4. 権威バイアス
  {
    pattern: /(?:上(?:が|の指示|の方針)|社長(?:が|も)|部長(?:が|も)|先輩(?:が|も)|専門家(?:が|も)|偉い人)/,
    type: 'authority_bias',
    description: '権威への過度な依存',
    correctionHint: '権威者の意見の根拠そのものを確認、独立した判断根拠の有無を確認',
    socraticTemplate: 'その方の意見を除外した場合、データや事実だけから同じ結論に至りますか？',
  },
  // 5. 過信バイアス
  {
    pattern: /(?:絶対|間違いない|確実(?:に|だ)|100%|疑いなく)/,
    type: 'overconfidence',
    description: '過度な確信',
    correctionHint: '不確実性やリスク要因の見落としがないか確認',
    socraticTemplate: 'この確信度を下げる要因があるとすれば、何が考えられますか？',
  },
  // 6. アンカリング（v4.0追加）
  {
    pattern: /(?:最初に聞いた|当初は|第一印象|最初の提案|初期値|当初の.*想定)/,
    type: 'anchoring',
    description: '最初に得た情報に過度に引きずられる',
    correctionHint: '現在の情報のみで再評価した場合の結論を確認',
    socraticTemplate: '現在の市場環境だけで見た場合、同じ結論になりますか？',
  },
  // 7. 近時バイアス（v4.0追加）
  {
    pattern: /(?:最近は|ここ数ヶ月|直近の|この前の|つい先日|最近の.*(?:から|ので))/,
    type: 'recency',
    description: '直近の情報に過度に影響される',
    correctionHint: '長期データとの比較、直近の例外性の確認',
    socraticTemplate: '過去5年間のデータで見た場合、同じ判断になりますか？',
  },
  // 8. 正常性バイアス（v4.0追加）
  {
    pattern: /(?:今まで大丈夫だった|前例がない|起きるはずがない|まさか|ありえない)/,
    type: 'normality_bias',
    description: '異常事態が起きないと思い込む',
    correctionHint: 'ブラックスワン事象の可能性、最悪シナリオの検討',
    socraticTemplate: '「今まで大丈夫だった」以外に、今後も大丈夫と言える根拠はありますか？',
  },
  // 9. ハロー効果（v4.0追加）
  {
    pattern: /(?:あの会社だから|ブランド力|有名な|実績がある(?:から|ので)|名前が通って)/,
    type: 'halo_effect',
    description: '一部の印象が全体の評価に影響',
    correctionHint: '個別の評価項目ごとに客観的に検証',
    socraticTemplate: 'もし無名の会社が同じ提案をした場合、同じ評価になりますか？',
  },
  // 10. 集団思考（v4.0追加）
  {
    pattern: /(?:みんなそう|チームの総意|異論は出な|全員一致|コンセンサス)/,
    type: 'groupthink',
    description: '集団の合意に同調し異論を抑制',
    correctionHint: '反対意見の有無、個別の検討プロセスの確認',
    socraticTemplate: 'もしあなただけが反対意見を持っていたとしたら、どう主張しますか？',
  },
]

// --- バイアスラベル（10種） ---

const BIAS_LABELS: Record<string, string> = {
  optimistic_assertion: '楽観バイアス',
  confirmation_bias: '確証バイアス',
  sunk_cost: 'サンクコスト',
  authority_bias: '権威バイアス',
  overconfidence: '過信バイアス',
  anchoring: 'アンカリング',
  recency: '近時バイアス',
  normality_bias: '正常性バイアス',
  halo_effect: 'ハロー効果',
  groupthink: '集団思考',
}

// --- デフォルト設定（後方互換用: v3.0の5種） ---

const DEFAULT_BIAS_CONFIG: BiasConfig = {
  enabled_biases: ['optimistic_assertion', 'confirmation_bias', 'sunk_cost', 'authority_bias', 'overconfidence'],
  max_per_session: 2,
  min_interval: 3,
  confidence_threshold: 0.7,
  patterns: {},
  socratic_templates: {},
}

// --- Helper ---

function getActivePatterns(config?: BiasConfig): BiasPattern[] {
  const enabled = config?.enabled_biases ?? DEFAULT_BIAS_CONFIG.enabled_biases
  return MASTER_BIAS_REGISTRY.filter((bp) => enabled.includes(bp.type))
}

function getConfig(config?: BiasConfig): BiasConfig {
  return config ?? DEFAULT_BIAS_CONFIG
}

// --- Stage 1: Pattern Matching ---

export function detectBiasPatterns(userMessage: string, config?: BiasConfig): DetectedBias[] {
  const patterns = getActivePatterns(config)
  const detected: DetectedBias[] = []
  for (const bp of patterns) {
    const match = userMessage.match(bp.pattern)
    if (match) {
      detected.push({
        biasType: bp.type,
        originalText: userMessage,
        matchedText: match[0],
        description: bp.description,
        correctionHint: bp.correctionHint,
      })
    }
  }
  return detected
}

export async function saveBiasFlags(
  requestId: string,
  messageId: string | undefined,
  pbmStep: number,
  detectedBiases: DetectedBias[],
  config?: BiasConfig
): Promise<void> {
  const conf = getConfig(config)
  for (const bias of detectedBiases) {
    await query(
      `INSERT INTO bias_flags (id, request_id, source_message_id, bias_type, detection_stage, original_text, status, pbm_step, confidence_score, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pattern_match', $5, 'pending', $6, $7, NOW(), NOW())`,
      [ulid(), requestId, messageId || null, bias.biasType, bias.originalText, pbmStep, conf.confidence_threshold]
    )
  }
  if (detectedBiases.length > 0) {
    console.log(
      `[BiasDetector] Detected ${detectedBiases.length} bias(es):`,
      detectedBiases.map((b) => b.biasType).join(', ')
    )
  }
}

// --- Insertion Timing Control ---

export async function shouldInjectBias(requestId: string, config?: BiasConfig): Promise<boolean> {
  const conf = getConfig(config)

  const injectedRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM bias_flags
     WHERE request_id = $1 AND status = 'injected'`,
    [requestId]
  )
  const injectedCount = parseInt(injectedRows[0]?.count || '0', 10)
  if (injectedCount >= conf.max_per_session) return false

  const lastInjected = await query<{ source_message_id: string }>(
    `SELECT source_message_id FROM bias_flags
     WHERE request_id = $1 AND status = 'injected'
     ORDER BY updated_at DESC LIMIT 1`,
    [requestId]
  )
  if (lastInjected.length > 0 && lastInjected[0].source_message_id) {
    const messagesSince = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM messages
       WHERE request_id = $1 AND created_at > (
         SELECT created_at FROM messages WHERE id = $2
       )`,
      [requestId, lastInjected[0].source_message_id]
    )
    const interval = parseInt(messagesSince[0]?.count || '0', 10)
    if (interval < conf.min_interval) return false
  }
  return true
}

// --- Stage 2: LLM Context Injection ---

export async function getBiasAlerts(requestId: string, config?: BiasConfig): Promise<string> {
  const conf = getConfig(config)
  const canInject = await shouldInjectBias(requestId, config)
  if (!canInject) return ''

  const rows = await query<PendingBiasFlag>(
    `SELECT id, bias_type, original_text, correction_question, detection_stage
     FROM bias_flags
     WHERE request_id = $1 AND status = 'pending'
       AND (confidence_score IS NULL OR confidence_score >= $2)
     ORDER BY created_at ASC
     LIMIT 2`,
    [requestId, conf.confidence_threshold]
  )

  if (rows.length === 0) return ''

  const alerts = rows.map((row) => {
    const label = BIAS_LABELS[row.bias_type] || row.bias_type
    const pattern = MASTER_BIAS_REGISTRY.find((p) => p.type === row.bias_type)
    const hint = pattern?.correctionHint || ''
    const socratic = pattern?.socraticTemplate || ''
    const shortText = row.original_text && row.original_text.length > 50
      ? row.original_text.substring(0, 50) + '...'
      : row.original_text || ''
    return `- 「${shortText}」→ ${label}の可能性。${hint}\n  ソクラテス式質問例: ${socratic}`
  })

  return `## バイアス検出アラート
以下のバイアスの可能性が検出されました。自然な会話の中で、適切なタイミングで確認の質問を挿入してください。
即座に問い詰めるのではなく、話題の区切りで自然に問いかけてください。
1回の応答で対応するバイアスは1つまでにしてください。

${alerts.join('\n')}

バイアス確認の質問を行った場合は、HEARING_META の step_signals に "bias_addressed": true を含めてください。`
}

export async function markBiasesAsInjected(requestId: string): Promise<void> {
  await query(
    `UPDATE bias_flags SET status = 'injected', updated_at = NOW()
     WHERE request_id = $1 AND status = 'pending'`,
    [requestId]
  )
}
