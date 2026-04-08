class AddFiveAxisColumns < ActiveRecord::Migration[8.0]
  def change
    # hearing_extracts: リスク軸・データソース・検証要件を追加
    add_column :hearing_extracts, :risk_axis, :string, comment: "リスク軸 (target_risk/structural_risk/external_risk/operational_risk/concentration_risk/information_risk)"
    add_column :hearing_extracts, :data_source, :string, comment: "データソース (self_report/internal_db/derived/third_party_db)"
    add_column :hearing_extracts, :verification_requirement, :string, comment: "検証要件 (required/optional/not_required)"
    add_index :hearing_extracts, [:request_id, :risk_axis]

    # hearing_step_states: レイヤーカバレッジ追跡
    add_column :hearing_step_states, :layer_coverage, :jsonb, default: {}, null: false, comment: "レイヤーごとの抽出件数 {0: n, 1: n, ...}"

    # bias_flags: confidence_score 追加
    add_column :bias_flags, :confidence_score, :decimal, precision: 3, scale: 2, comment: "検出信頼度 (0.00-1.00)"
  end
end
