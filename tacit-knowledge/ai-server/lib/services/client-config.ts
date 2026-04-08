/**
 * 統一クライアント設定インターフェース
 *
 * Production (Sharp Finance) と Demo (Daiwa Energy) の両方が同一の ClientConfig 型を使用。
 * Production: data/clients/sharp-finance.json からロード
 * Demo: data/demo/daiwa-client-config.json からロード
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// --- Types ---

export interface ClientConfig {
  client_id: string
  client_name: string
  industry?: string

  pbm_config: PbmConfig
  bias_config: BiasConfig
  elicitation_config: ElicitationConfig
  knowledge_granularity_config: KnowledgeGranularityConfig
  contradiction_config: ContradictionConfig
  saturation_config: SaturationConfig

  // Optional: model_b, risk_axis_examples, etc. (client-specific)
  model_b?: unknown
  mock_request_data?: unknown
}

export interface PbmConfig {
  total_steps: number
  steps: PbmStepConfig[]
}

export interface PbmStepConfig {
  step: number
  name_en: string
  name_jp: string
  purpose: string
  advance_condition: string
  completion_criteria: string
  context: string
  target_layers: number[]
}

export interface BiasConfig {
  enabled_biases: string[]
  max_per_session: number
  min_interval: number
  confidence_threshold: number
  patterns: Record<string, string[]>
  socratic_templates: Record<string, string>
}

export interface ElicitationConfig {
  methods: string[]
  step_method_matrix: Record<number, string[]>
  max_methods_per_step: number
}

export interface KnowledgeGranularityConfig {
  knowledge_forms: string[]
  promotion_rules: PromotionRule[]
}

export interface PromotionRule {
  from_form: string
  from_medallion: string
  required_method: string
  to_form: string
}

export interface ContradictionConfig {
  enabled_types: string[]
  similarity_threshold: number
  confirmation_template: string
}

export interface SaturationConfig {
  novelty_threshold: number
  consecutive_count: number
}

// --- Config Cache ---

const configCache = new Map<string, ClientConfig>()

// --- Loaders ---

export function loadClientConfig(mode: 'production' | 'demo', clientId: string): ClientConfig {
  const cacheKey = `${mode}:${clientId}`
  const cached = configCache.get(cacheKey)
  if (cached) return cached

  let configPath: string
  if (mode === 'demo') {
    const DEMO_CONFIG_MAP: Record<string, string> = {
      daiwa_ei: 'daiwa-client-config.json',
      suntory_azusa: 'suntory-client-config.json',
    }
    const filename = DEMO_CONFIG_MAP[clientId] || 'daiwa-client-config.json'
    configPath = join(process.cwd(), `data/demo/${filename}`)
  } else {
    configPath = join(process.cwd(), `data/clients/${clientId}.json`)
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf-8'))
  const config = normalizeConfig(raw)
  configCache.set(cacheKey, config)
  return config
}

/**
 * JSON にv4.0フィールドが欠けている場合にデフォルト値を補完
 */
function normalizeConfig(raw: Record<string, unknown>): ClientConfig {
  const config = raw as unknown as ClientConfig

  // elicitation_config のデフォルト
  if (!config.elicitation_config) {
    config.elicitation_config = {
      methods: ['cdm', 'contrast', 'boundary', 'hypothetical', 'exception'],
      step_method_matrix: {},
      max_methods_per_step: 2,
    }
  }

  // knowledge_granularity_config のデフォルト
  if (!config.knowledge_granularity_config) {
    config.knowledge_granularity_config = {
      knowledge_forms: ['explicit_rule', 'heuristic', 'pattern', 'conditional', 'tradeoff'],
      promotion_rules: [
        { from_form: 'pattern', from_medallion: 'bronze', required_method: 'contrast', to_form: 'conditional' },
      ],
    }
  }

  // contradiction_config のデフォルト
  if (!config.contradiction_config) {
    config.contradiction_config = {
      enabled_types: ['session_internal'],
      similarity_threshold: 0.85,
      confirmation_template: '先ほど「{previous_content}」とおっしゃいましたが、今のお話と合わせるとどう理解すればいいですか？',
    }
  }

  // saturation_config のデフォルト
  if (!config.saturation_config) {
    config.saturation_config = {
      novelty_threshold: 0.8,
      consecutive_count: 3,
    }
  }

  return config
}

/**
 * テスト・開発用: キャッシュをクリア
 */
export function clearConfigCache(): void {
  configCache.clear()
}
