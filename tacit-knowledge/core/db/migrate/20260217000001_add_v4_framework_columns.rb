class AddV4FrameworkColumns < ActiveRecord::Migration[8.0]
  def change
    # hearing_extracts: v4.0 知識工学フレームワーク用カラム追加
    add_column :hearing_extracts, :knowledge_form, :string, comment: "知識粒度 (explicit_rule/heuristic/pattern/conditional/tradeoff)"
    add_column :hearing_extracts, :elicitation_method, :string, comment: "引き出し手法 (cdm/contrast/boundary/hypothetical/exception)"
    add_column :hearing_extracts, :context_conditions, :jsonb, default: [], null: false, comment: "文脈条件 [{condition, override}]"
    add_column :hearing_extracts, :applicability_scope, :string, comment: "適用範囲"
    add_column :hearing_extracts, :temporal_validity, :string, comment: "時間的有効性"
    add_column :hearing_extracts, :check_item_id, :string, comment: "チェック項目ID"
    add_column :hearing_extracts, :confidence, :decimal, precision: 3, scale: 2, comment: "確信度 (0.00-1.00)"
    add_column :hearing_extracts, :novelty_score, :decimal, precision: 3, scale: 2, comment: "新規性スコア (0.00-1.00)"

    # hearing_step_states: 飽和度トラッキング
    add_column :hearing_step_states, :saturation_state, :jsonb, default: {}, null: false, comment: "飽和状態 {consecutiveHighOverlap, saturatedLayers}"
    add_column :hearing_step_states, :coverage_map, :jsonb, default: {}, null: false, comment: "カバレッジマップ (6軸×5層=30セル)"

    # contradiction_flags: 矛盾検出テーブル新設
    create_table :contradiction_flags, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :request_id, null: false
      t.string :contradiction_type, null: false, comment: "矛盾タイプ (session_internal/cross_expert/rule_violation/temporal)"
      t.text :content_a, null: false, comment: "既存発言"
      t.text :content_b, null: false, comment: "新規発言"
      t.decimal :similarity_score, precision: 5, scale: 4, comment: "類似度スコア"
      t.text :confirmation_question, comment: "確認質問テンプレート"
      t.string :status, null: false, default: "pending", comment: "ステータス (pending/confirmed/dismissed)"
      t.timestamps
    end

    add_index :contradiction_flags, [:request_id, :status]
    add_index :contradiction_flags, :request_id
  end
end
