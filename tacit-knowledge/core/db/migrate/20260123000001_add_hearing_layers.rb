class AddHearingLayers < ActiveRecord::Migration[8.0]
  def change
    # PBM ステップ状態
    # ヒアリングの進行をステートマシンで管理する
    # Step 0: Hard NG排除, Step 1: 前提確認, Step 2: 定量・定性評価
    create_table :hearing_step_states, id: { type: :string, limit: 26 }, comment: "PBM ステップ状態" do |t|
      t.string :request_id, null: false, limit: 26, comment: "リクエストID"
      t.integer :current_step, default: 0, null: false, comment: "現在のステップ (0=Hard NG排除, 1=前提確認, 2=定量評価)"
      t.string :current_step_status, default: 'active', null: false, comment: "ステップ状態 (active/completed)"
      t.jsonb :step_completion, default: {}, null: false, comment: "ステップごとの完了情報"
      t.jsonb :extracted_knowledge, default: {}, null: false, comment: "ステップごとの抽出済み知識"
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index :request_id, unique: true
    end

    # ヒアリング抽出データ
    # LLM が構造化出力として返した知識を蓄積する
    create_table :hearing_extracts, id: { type: :string, limit: 26 }, comment: "ヒアリング抽出データ" do |t|
      t.string :request_id, null: false, limit: 26, comment: "リクエストID"
      t.string :source_message_id, limit: 26, comment: "元となったメッセージID"
      t.integer :pbm_step, null: false, comment: "抽出時の PBM ステップ (0-2)"
      t.integer :knowledge_layer, null: false, comment: "知識レイヤー (0=原則, 1=判断基準, 2=リスク構造, 3=案件事実, 4=判断プロセス)"
      t.text :content, null: false, comment: "抽出された知識"
      t.text :hypothesis, comment: "生成された仮説"
      t.string :data_type, comment: "データ種別 (immutable/stable/variable/historical) - Phase2用"
      t.string :medallion, default: 'bronze', comment: "データ品質 (bronze/silver/gold) - Phase2用"
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:request_id, :pbm_step]
      t.index [:request_id, :knowledge_layer]
      t.index :source_message_id
    end

    # バイアスフラグ
    # 2段階バイアス検出の結果を保持する
    # Stage 1: パターンマッチング (コスト0), Stage 2: LLMコンテキスト判定
    create_table :bias_flags, id: { type: :string, limit: 26 }, comment: "バイアス検出フラグ" do |t|
      t.string :request_id, null: false, limit: 26, comment: "リクエストID"
      t.string :source_message_id, limit: 26, comment: "検出元メッセージID"
      t.string :bias_type, null: false, comment: "バイアス種別 (optimistic_assertion/confirmation_bias/sunk_cost/groupthink/overconfidence/vague_reasoning)"
      t.string :detection_stage, null: false, comment: "検出段階 (pattern_match/llm_contextual)"
      t.text :original_text, comment: "バイアスが検出された元テキスト"
      t.text :correction_question, comment: "生成された補正質問"
      t.string :status, default: 'pending', null: false, comment: "ステータス (pending/injected/dismissed)"
      t.integer :pbm_step, comment: "検出時の PBM ステップ"
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false

      t.index [:request_id, :status]
      t.index [:request_id, :pbm_step]
      t.index :source_message_id
    end

    # messages テーブルへの追加カラム
    add_column :messages, :pbm_step, :integer, comment: "このメッセージ時点の PBM ステップ"
    add_column :messages, :meta_json, :jsonb, default: {}, comment: "LLM が出力した構造化メタデータ (HEARING_META)"

    # 外部キー制約
    add_foreign_key :hearing_step_states, :requests, on_delete: :cascade
    add_foreign_key :hearing_extracts, :requests, on_delete: :cascade
    add_foreign_key :hearing_extracts, :messages, column: :source_message_id, on_delete: :nullify
    add_foreign_key :bias_flags, :requests, on_delete: :cascade
    add_foreign_key :bias_flags, :messages, column: :source_message_id, on_delete: :nullify
  end
end
