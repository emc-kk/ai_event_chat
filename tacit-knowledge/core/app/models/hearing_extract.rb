class HearingExtract < ApplicationRecord
  belongs_to :request
  belongs_to :source_message, class_name: 'Message', optional: true

  LAYER_NAMES = {
    0 => '原則',
    1 => '判断基準',
    2 => 'リスク構造',
    3 => '案件事実',
    4 => '判断プロセス'
  }.freeze

  RISK_AXES = %w[
    target_risk
    structural_risk
    external_risk
    operational_risk
    concentration_risk
    information_risk
  ].freeze

  RISK_AXIS_NAMES = {
    'target_risk' => '対象そのもののリスク',
    'structural_risk' => '構造・契約のリスク',
    'external_risk' => '外生環境リスク',
    'operational_risk' => '実行・運営リスク',
    'concentration_risk' => '集中・相関リスク',
    'information_risk' => '情報・前提リスク'
  }.freeze

  DATA_4TYPES = %w[
    D1_immutable
    D2_stable
    D3_variable
    D4_historical
  ].freeze

  DATA_SOURCES = %w[
    self_report
    internal_db
    derived
    third_party_db
  ].freeze

  VERIFICATION_REQUIREMENTS = %w[
    optional
    required
    not_required
  ].freeze

  validates :pbm_step, inclusion: { in: [0, 1, 2] }
  validates :knowledge_layer, inclusion: { in: [0, 1, 2, 3, 4] }
  validates :content, presence: true
  validates :risk_axis, inclusion: { in: RISK_AXES }, allow_nil: true
  validates :data_type, inclusion: { in: DATA_4TYPES }, allow_nil: true
  validates :data_source, inclusion: { in: DATA_SOURCES }, allow_nil: true
  validates :verification_requirement, inclusion: { in: VERIFICATION_REQUIREMENTS }, allow_nil: true

  def layer_name
    LAYER_NAMES[knowledge_layer] || "Layer #{knowledge_layer}"
  end

  def risk_axis_name
    RISK_AXIS_NAMES[risk_axis] || risk_axis
  end
end
