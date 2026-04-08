/**
 * 引き出し手法フレームワーク（v4.0 新規）
 *
 * 知識工学の確立された5手法をフレームワーク化。
 * 「何を聞くか」だけでなく「どう聞くか」をコード側で制御し、
 * LLMの質問生成の揺らぎを抑制する。
 *
 * 制御方式:
 *   - コード側がPBMステップ×手法マトリクスから適用手法を決定
 *   - LLMは指定された手法のパターンに従って質問を生成
 *   - 同一ステップ内で2手法まで。レイヤーカバレッジの偏りに応じて切替
 *   - 各抽出物にelicitation_methodを記録
 */

import type { ElicitationConfig } from './client-config'

// --- 手法定義（仕様書TABLE 5準拠） ---

interface MethodDefinition {
  code: string
  nameJp: string
  definition: string
  targetLayers: string
  instruction: string
  questionPatterns: string[]
}

const METHOD_DEFINITIONS: Record<string, MethodDefinition> = {
  cdm: {
    code: 'cdm',
    nameJp: 'Critical Decision Method（過去判断の再体験）',
    definition: '過去の具体的な判断場面を1つ選ばせ、時系列で掘り下げる',
    targetLayers: 'L4判断プロセス + L2リスク構造',
    instruction: '過去の具体的な判断場面を1つ選ばせ、その場面を時系列で掘り下げてください。「最も迷った」「印象に残っている」案件を起点に、何が決め手だったか、どんな情報を参照したかを引き出してください。',
    questionPatterns: [
      '最も判断に迷った案件を1つ教えてください。何が決め手でしたか？',
      'その時、どんな情報を参照して判断しましたか？',
      '振り返って、あの判断は正しかったですか？なぜそう思いますか？',
    ],
  },
  contrast: {
    code: 'contrast',
    nameJp: '対比法（Contrasting Cases）',
    definition: '通した案件と落とした案件を対にして違いを言語化させる',
    targetLayers: 'L1判断基準 + L4判断プロセス',
    instruction: '類似だが結果が異なった2つのケースを比較させてください。「通した案件」と「落とした案件」「うまくいった案件」と「失敗した案件」を対にし、違いを言語化させることで暗黙の判断基準を明示化します。',
    questionPatterns: [
      '通した案件Aと落とした案件Bがあるとして、判断の分かれ目は何でしたか？',
      '似ているのに結果が違った2つのケースでは、どこが違いましたか？',
      'この基準で通した案件と落とした案件を比較すると、何が決定的に異なりますか？',
    ],
  },
  boundary: {
    code: 'boundary',
    nameJp: '境界条件プロービング',
    definition: 'ギリギリOK/NGだったケースを聞き、閾値の暗黙知を明示化',
    targetLayers: 'L1判断基準',
    instruction: '判断の境界線を探ってください。「ギリギリOK」「ギリギリNG」だったケースを聞き、数値閾値や定性的な判断基準の限界を明示化します。条件を段階的に変化させて、判断が変わるポイントを特定してください。',
    questionPatterns: [
      'ギリギリOKだった案件は？なぜOK側に倒しましたか？',
      'この数値がどこまで悪化したら、判断が変わりますか？',
      'あと何が1つ加わったら、NGになっていましたか？',
    ],
  },
  hypothetical: {
    code: 'hypothetical',
    nameJp: '仮想シナリオ',
    definition: '未経験の状況を仮定して判断予測させる',
    targetLayers: 'L2リスク構造 + L4判断プロセス',
    instruction: '未経験の仮想シナリオを提示して判断を予測させてください。「もし〜が〜だったら」という仮定で、条件を複合的に変化させ、判断の柔軟性と限界を探ります。ストレステスト的な質問が有効です。',
    questionPatterns: [
      'もし○○が△△になったら、判断は変わりますか？',
      'この条件に加えて、さらに□□が起きた場合はどうしますか？',
      '前例のないこの状況で、あなたならどう判断しますか？',
    ],
  },
  exception: {
    code: 'exception',
    nameJp: '例外パターン',
    definition: 'ルールが当てはまらなかったケースを聞き、ルールの限界を把握',
    targetLayers: 'L0不変原則 + L1判断基準',
    instruction: 'ルールや基準が当てはまらなかった例外ケースを聞いてください。「このルールの例外」「通常と異なる対応をした場面」を引き出し、ルールの適用限界と例外処理の暗黙知を明示化します。',
    questionPatterns: [
      'このルールが当てはまらなかったケースはありますか？',
      '通常のプロセスとは異なる対応をした場面を教えてください',
      'この基準を無視して判断したことはありますか？その理由は？',
    ],
  },
}

// --- 手法選択 ---

export interface ElicitationSelection {
  primary: string
  secondary: string | null
}

/**
 * 現在のPBMステップとカバレッジ状況から適用手法を選択する。
 * コード側が100%制御し、LLMは判断しない。
 */
export function selectElicitationMethod(
  config: ElicitationConfig,
  currentStep: number,
  layerCoverage: Record<number, number>,
  targetLayers: number[]
): ElicitationSelection {
  const matrix = config.step_method_matrix[currentStep]
  if (!matrix || matrix.length === 0) {
    return { primary: 'cdm', secondary: null }
  }

  const primary = matrix[0]
  const secondary = matrix.length > 1 ? matrix[1] : null

  // カバレッジ偏りチェック: ターゲットレイヤーの中で未カバーが多い場合、secondaryに切替
  if (secondary && isLayerImbalanced(layerCoverage, targetLayers)) {
    return { primary: secondary, secondary: primary }
  }

  return { primary, secondary }
}

/**
 * レイヤーカバレッジの偏りを検出する。
 * ターゲットレイヤーの中で、カバレッジ0のレイヤーが過半数を占める場合に偏りありと判定。
 */
function isLayerImbalanced(
  coverage: Record<number, number>,
  targetLayers: number[]
): boolean {
  if (targetLayers.length === 0) return false
  const uncoveredCount = targetLayers.filter((l) => (coverage[l] || 0) === 0).length
  return uncoveredCount > targetLayers.length / 2
}

// --- プロンプトフラグメント生成 ---

/**
 * システムプロンプトに動的挿入する引き出し手法指示テキストを生成する。
 */
export function buildElicitationPromptFragment(
  primary: string,
  secondary: string | null
): string {
  const method = METHOD_DEFINITIONS[primary]
  if (!method) return ''

  let fragment = `## 引き出し手法指示（コード側制御）

現在のステップでは「${method.nameJp}」を優先使用してください。

### 手法の定義
${method.definition}

### 質問生成の指針
${method.instruction}

### 質問パターン例
${method.questionPatterns.map((q) => `- ${q}`).join('\n')}

**重要**: 各抽出物のHEARING_META extracts内に "elicitation_method": "${primary}" を記録してください。`

  if (secondary) {
    const secondaryMethod = METHOD_DEFINITIONS[secondary]
    if (secondaryMethod) {
      fragment += `

### 補助手法（カバレッジが偏っている場合に切替）
「${secondaryMethod.nameJp}」も使用可能です。
${secondaryMethod.instruction}
切替した場合は elicitation_method を "${secondary}" に変更してください。`
    }
  }

  return fragment
}

/**
 * 利用可能な手法一覧を取得（config確認用）
 */
export function getAvailableMethods(): string[] {
  return Object.keys(METHOD_DEFINITIONS)
}
