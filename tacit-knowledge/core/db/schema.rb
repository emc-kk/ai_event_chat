# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_03_26_060206) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "vector"

  create_table "admins", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "name", comment: "管理者名"
    t.string "email", comment: "メールアドレス"
    t.string "password_digest", comment: "パスワード"
    t.integer "status", default: 0, comment: "ステータス"
    t.string "session_token", comment: "セッショントークン"
    t.text "note", comment: "メモ"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "company_id", limit: 26
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.index ["company_id"], name: "index_admins_on_company_id"
    t.index ["confirmation_token"], name: "index_admins_on_confirmation_token", unique: true
    t.index ["email"], name: "index_admins_on_email", unique: true
  end

  create_table "bias_flags", id: { type: :string, limit: 26 }, comment: "バイアス検出フラグ", force: :cascade do |t|
    t.string "request_id", limit: 26, null: false, comment: "リクエストID"
    t.string "source_message_id", limit: 26, comment: "検出元メッセージID"
    t.string "bias_type", null: false, comment: "バイアス種別 (optimistic_assertion/confirmation_bias/sunk_cost/groupthink/overconfidence/vague_reasoning)"
    t.string "detection_stage", null: false, comment: "検出段階 (pattern_match/llm_contextual)"
    t.text "original_text", comment: "バイアスが検出された元テキスト"
    t.text "correction_question", comment: "生成された補正質問"
    t.string "status", default: "pending", null: false, comment: "ステータス (pending/injected/dismissed)"
    t.integer "pbm_step", comment: "検出時の PBM ステップ"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "confidence_score", precision: 3, scale: 2, comment: "検出信頼度 (0.00-1.00)"
    t.index ["request_id", "pbm_step"], name: "index_bias_flags_on_request_id_and_pbm_step"
    t.index ["request_id", "status"], name: "index_bias_flags_on_request_id_and_status"
    t.index ["source_message_id"], name: "index_bias_flags_on_source_message_id"
  end

  create_table "chapters", id: { type: :string, limit: 26 }, comment: "チャプター保存", force: :cascade do |t|
    t.string "manual_id", limit: 26, null: false, comment: "マニュアルID"
    t.integer "sequence", null: false, comment: "表示順"
    t.decimal "start_second", precision: 10, scale: 3, null: false, comment: "開始時間(秒)"
    t.decimal "end_second", precision: 10, scale: 3, null: false, comment: "終了時間(秒)"
    t.string "title", comment: "タイトル"
    t.text "description", comment: "説明"
    t.text "thumbnail_path", comment: "サムネイルパス"
    t.boolean "is_visible", default: true, null: false, comment: "表示可否"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "request_document_id", limit: 26, comment: "動画ドキュメントID"
    t.index ["manual_id"], name: "index_chapters_on_manual_id"
    t.index ["request_document_id"], name: "index_chapters_on_request_document_id"
  end

  create_table "companies", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_companies_on_name"
  end

  create_table "company_features", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "company_id", null: false
    t.string "feature_id", null: false
    t.boolean "enabled", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "feature_id"], name: "index_company_features_on_company_id_and_feature_id", unique: true
    t.index ["feature_id"], name: "index_company_features_on_feature_id"
  end

  create_table "company_glossary_terms", id: { type: :string, limit: 26 }, comment: "社内辞書", force: :cascade do |t|
    t.string "company_id", limit: 26, null: false, comment: "会社ID"
    t.string "term", null: false, comment: "用語"
    t.text "definition", null: false, comment: "定義"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者ID"
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.string "updated_by_id", limit: 26, comment: "更新者ID"
    t.string "updated_by_type", comment: "更新者の型（Admin or User）"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "term_group", comment: "用語グループ"
    t.index ["company_id", "term"], name: "idx_glossary_company_term_unique", unique: true
    t.index ["company_id", "term_group"], name: "idx_glossary_company_term_group"
    t.index ["company_id"], name: "idx_glossary_company"
    t.index ["created_by_type", "created_by_id"], name: "idx_glossary_created_by"
  end

  create_table "comparison_elements", id: { type: :string, limit: 26 }, comment: "比較要素", force: :cascade do |t|
    t.string "comparison_session_id", limit: 26, null: false, comment: "所属する比較セッションID"
    t.integer "classification", null: false, comment: "分類 (0=consensus, 1=divergence, 2=gap)"
    t.text "knowledge_element", null: false, comment: "比較対象の知識要素の要約"
    t.jsonb "responses", default: [], null: false, comment: "[{request_id, respondent_name, content}] ベテランごとの回答"
    t.integer "resolution", comment: "解決方法 (0=adopted, 1=merged_condition, 2=flagged)"
    t.jsonb "resolution_detail", comment: "採用したrequest_id、条件分岐の記述、フラグ理由などの詳細"
    t.text "resolution_comment", comment: "意思決定の理由コメント（任意）"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "resolution_note"
    t.index ["classification"], name: "index_comparison_elements_on_classification"
    t.index ["comparison_session_id"], name: "index_comparison_elements_on_comparison_session_id"
  end

  create_table "comparison_sessions", id: { type: :string, limit: 26 }, comment: "ベテラン知識比較セッション", force: :cascade do |t|
    t.string "topic_id", limit: 26, null: false, comment: "対象トピックID"
    t.jsonb "request_ids", default: [], null: false, comment: "比較対象のヒアリングリクエストID群"
    t.integer "status", default: 0, null: false, comment: "ステータス (0=analyzing, 1=in_review, 2=completed)"
    t.decimal "consensus_rate", precision: 5, scale: 4, comment: "知識一致率 (0.0〜1.0)"
    t.string "merged_topic_id", limit: 26, comment: "統合ナレッジ生成後の参照先Topic ID"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者ID"
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_comparison_sessions_on_status"
    t.index ["topic_id"], name: "index_comparison_sessions_on_topic_id"
  end

  create_table "contradiction_flags", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "request_id", null: false
    t.string "contradiction_type", null: false, comment: "矛盾タイプ (session_internal/cross_expert/rule_violation/temporal)"
    t.text "content_a", null: false, comment: "既存発言"
    t.text "content_b", null: false, comment: "新規発言"
    t.decimal "similarity_score", precision: 5, scale: 4, comment: "類似度スコア"
    t.text "confirmation_question", comment: "確認質問テンプレート"
    t.string "status", default: "pending", null: false, comment: "ステータス (pending/confirmed/dismissed)"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["request_id", "status"], name: "index_contradiction_flags_on_request_id_and_status"
    t.index ["request_id"], name: "index_contradiction_flags_on_request_id"
  end

  create_table "cross_user_conflicts", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "topic_id", null: false
    t.string "request_a_id", null: false
    t.string "request_b_id", null: false
    t.text "question_a", null: false
    t.text "answer_a", null: false
    t.text "question_b", null: false
    t.text "answer_b", null: false
    t.float "similarity", null: false
    t.string "status", default: "pending", null: false
    t.text "resolution_note"
    t.string "resolved_by_type"
    t.string "resolved_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["request_a_id"], name: "index_cross_user_conflicts_on_request_a_id"
    t.index ["request_b_id"], name: "index_cross_user_conflicts_on_request_b_id"
    t.index ["resolved_by_type", "resolved_by_id"], name: "index_cross_user_conflicts_on_resolved_by"
    t.index ["status"], name: "index_cross_user_conflicts_on_status"
    t.index ["topic_id"], name: "index_cross_user_conflicts_on_topic_id"
  end

  create_table "data_acquisition_job_runs", id: :string, force: :cascade do |t|
    t.string "job_id", null: false
    t.string "status", default: "running", null: false
    t.datetime "started_at"
    t.datetime "completed_at"
    t.integer "tasks_total", default: 0
    t.integer "tasks_completed", default: 0
    t.integer "tasks_failed", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["job_id"], name: "index_data_acquisition_job_runs_on_job_id"
    t.index ["status"], name: "index_data_acquisition_job_runs_on_status"
  end

  create_table "data_acquisition_jobs", id: :string, force: :cascade do |t|
    t.string "name", null: false
    t.text "description"
    t.jsonb "job_definition", default: {}, null: false
    t.string "status", default: "active", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "company_id", limit: 26, null: false
    t.string "dispatch_target", default: "sqs", null: false
    t.index ["company_id"], name: "index_data_acquisition_jobs_on_company_id"
    t.index ["status"], name: "index_data_acquisition_jobs_on_status"
  end

  create_table "data_acquisition_records", id: :string, force: :cascade do |t|
    t.string "job_id", null: false
    t.string "run_id"
    t.string "task_id"
    t.string "record_type"
    t.jsonb "data", default: {}, null: false
    t.string "source_url"
    t.string "raw_s3_path"
    t.datetime "fetched_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "company_id", limit: 26, null: false
    t.index ["company_id", "record_type", "fetched_at"], name: "idx_datasource_records_company_type_fetched"
    t.index ["job_id"], name: "index_data_acquisition_records_on_job_id"
  end

  create_table "data_acquisition_tasks", id: :string, force: :cascade do |t|
    t.string "job_id", null: false
    t.string "run_id", null: false
    t.string "status", default: "queued", null: false
    t.jsonb "task_payload", default: {}, null: false
    t.string "worker_id"
    t.integer "attempt", default: 1
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "dispatch_target", default: "sqs", null: false
    t.string "assigned_instance_id"
    t.datetime "assigned_at"
    t.index ["assigned_instance_id"], name: "index_data_acquisition_tasks_on_assigned_instance_id"
    t.index ["dispatch_target", "status"], name: "idx_acq_tasks_dispatch_status"
    t.index ["job_id"], name: "index_data_acquisition_tasks_on_job_id"
    t.index ["run_id"], name: "index_data_acquisition_tasks_on_run_id"
    t.index ["status", "created_at"], name: "index_data_acquisition_tasks_on_status_and_created_at"
    t.index ["status"], name: "index_data_acquisition_tasks_on_status"
  end

  create_table "data_source_files", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "company_id", limit: 26, null: false, comment: "会社ID"
    t.string "folder_id", limit: 26, comment: "フォルダID"
    t.string "name", null: false, comment: "ファイル名"
    t.text "key", null: false, comment: "S3キー"
    t.string "file_type", comment: "ファイル種別 (pdf, xlsx, docx, pptx等)"
    t.bigint "file_size", comment: "ファイルサイズ（バイト）"
    t.integer "ai_status", default: 0, null: false, comment: "AI学習状態 (0=pending, 1=processing, 2=completed, 3=failed)"
    t.integer "token_count", comment: "トークン数"
    t.text "parsed_doc_key", comment: "パース済みドキュメントのS3キー"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者ID"
    t.string "updated_by_id", limit: 26, comment: "更新者ID"
    t.datetime "deleted_at", comment: "削除日時"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.string "updated_by_type", comment: "更新者の型（Admin or User）"
    t.index ["ai_status"], name: "index_data_source_files_on_ai_status"
    t.index ["company_id", "folder_id"], name: "idx_ds_files_company_folder"
    t.index ["created_by_type", "created_by_id"], name: "idx_ds_files_created_by"
    t.index ["deleted_at"], name: "index_data_source_files_on_deleted_at"
    t.index ["folder_id"], name: "index_data_source_files_on_folder_id"
    t.index ["updated_by_type", "updated_by_id"], name: "idx_ds_files_updated_by"
  end

  create_table "data_source_folders", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "company_id", limit: 26, null: false, comment: "会社ID"
    t.string "parent_id", limit: 26, comment: "親フォルダID"
    t.string "name", null: false, comment: "フォルダ名"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者ID"
    t.datetime "deleted_at", comment: "削除日時"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.index ["company_id", "parent_id"], name: "idx_ds_folders_company_parent"
    t.index ["created_by_type", "created_by_id"], name: "idx_ds_folders_created_by"
    t.index ["deleted_at"], name: "index_data_source_folders_on_deleted_at"
    t.index ["parent_id"], name: "index_data_source_folders_on_parent_id"
  end

  create_table "features", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "name", null: false
    t.integer "feature_type", null: false
    t.string "parent_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_features_on_name", unique: true
    t.index ["parent_id"], name: "index_features_on_parent_id"
  end

  create_table "hearing_extracts", id: { type: :string, limit: 26 }, comment: "ヒアリング抽出データ", force: :cascade do |t|
    t.string "request_id", limit: 26, null: false, comment: "リクエストID"
    t.string "source_message_id", limit: 26, comment: "元となったメッセージID"
    t.integer "pbm_step", null: false, comment: "抽出時の PBM ステップ (0-2)"
    t.integer "knowledge_layer", null: false, comment: "知識レイヤー (0=原則, 1=判断基準, 2=リスク構造, 3=案件事実, 4=判断プロセス)"
    t.text "content", null: false, comment: "抽出された知識"
    t.text "hypothesis", comment: "生成された仮説"
    t.string "data_type", comment: "データ種別 (immutable/stable/variable/historical) - Phase2用"
    t.string "medallion", default: "bronze", comment: "データ品質 (bronze/silver/gold) - Phase2用"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "risk_axis", comment: "リスク軸 (target_risk/structural_risk/external_risk/operational_risk/concentration_risk/information_risk)"
    t.string "data_source", comment: "データソース (self_report/internal_db/derived/third_party_db)"
    t.string "verification_requirement", comment: "検証要件 (required/optional/not_required)"
    t.string "knowledge_form", comment: "知識粒度 (explicit_rule/heuristic/pattern/conditional/tradeoff)"
    t.string "elicitation_method", comment: "引き出し手法 (cdm/contrast/boundary/hypothetical/exception)"
    t.jsonb "context_conditions", default: [], null: false, comment: "文脈条件 [{condition, override}]"
    t.string "applicability_scope", comment: "適用範囲"
    t.string "temporal_validity", comment: "時間的有効性"
    t.string "check_item_id", comment: "チェック項目ID"
    t.decimal "confidence", precision: 3, scale: 2, comment: "確信度 (0.00-1.00)"
    t.decimal "novelty_score", precision: 3, scale: 2, comment: "新規性スコア (0.00-1.00)"
    t.index ["request_id", "knowledge_layer"], name: "index_hearing_extracts_on_request_id_and_knowledge_layer"
    t.index ["request_id", "pbm_step"], name: "index_hearing_extracts_on_request_id_and_pbm_step"
    t.index ["request_id", "risk_axis"], name: "index_hearing_extracts_on_request_id_and_risk_axis"
    t.index ["source_message_id"], name: "index_hearing_extracts_on_source_message_id"
  end

  create_table "hearing_step_states", id: { type: :string, limit: 26 }, comment: "PBM ステップ状態", force: :cascade do |t|
    t.string "request_id", limit: 26, null: false, comment: "リクエストID"
    t.integer "current_step", default: 0, null: false, comment: "現在のステップ (0=Hard NG排除, 1=前提確認, 2=定量評価)"
    t.string "current_step_status", default: "active", null: false, comment: "ステップ状態 (active/completed)"
    t.jsonb "step_completion", default: {}, null: false, comment: "ステップごとの完了情報"
    t.jsonb "extracted_knowledge", default: {}, null: false, comment: "ステップごとの抽出済み知識"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "layer_coverage", default: {}, null: false, comment: "レイヤーごとの抽出件数 {0: n, 1: n, ...}"
    t.jsonb "saturation_state", default: {}, null: false, comment: "飽和状態 {consecutiveHighOverlap, saturatedLayers}"
    t.jsonb "coverage_map", default: {}, null: false, comment: "カバレッジマップ (6軸×5層=30セル)"
    t.index ["request_id"], name: "index_hearing_step_states_on_request_id", unique: true
  end

  create_table "hearing_suggestions", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "request_id", limit: 26, null: false
    t.text "question", null: false
    t.jsonb "answer_candidates", default: []
    t.string "category"
    t.boolean "is_answered", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["request_id", "is_answered"], name: "index_hearing_suggestions_on_request_id_and_is_answered"
    t.index ["request_id"], name: "index_hearing_suggestions_on_request_id"
  end

  create_table "manual_templates", id: { type: :string, limit: 26 }, comment: "マニュアルテンプレート", force: :cascade do |t|
    t.string "company_id", limit: 26, comment: "テナントID（プリセットの場合はnull）"
    t.string "name", null: false, comment: "テンプレート名"
    t.text "description", comment: "テンプレートの用途・概要"
    t.jsonb "sections", default: [], null: false, comment: "セクション定義 [{name, instruction}]"
    t.integer "output_format", default: 0, null: false, comment: "出力形式 (0=markdown, 1=docx)"
    t.boolean "is_preset", default: false, null: false, comment: "プリセットテンプレートか否か"
    t.string "created_by_id", limit: 26, comment: "作成者ID"
    t.string "created_by_type", comment: "作成者の型（Admin or User）"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "category", comment: "テンプレートカテゴリ（例: iso9001）。nilの場合は汎用プリセット"
    t.index ["category"], name: "index_manual_templates_on_category"
    t.index ["company_id"], name: "index_manual_templates_on_company_id"
    t.index ["is_preset"], name: "index_manual_templates_on_is_preset"
  end

  create_table "manuals", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "topic_id", limit: 26, null: false, comment: "トピックID"
    t.string "request_id", limit: 26, null: false, comment: "リクエストID"
    t.text "body", comment: "AIが生成したマニュアル本文"
    t.text "input_text", comment: "マニュアル作成画面で入力したテキスト"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "input_video_key"
    t.text "hls_video_key"
    t.string "video_id", limit: 26, comment: "動画ドキュメントID"
    t.string "manual_template_id", limit: 26, comment: "使用したテンプレートID"
    t.index ["manual_template_id"], name: "index_manuals_on_manual_template_id"
    t.index ["request_id"], name: "index_manuals_on_request_id"
    t.index ["topic_id"], name: "index_manuals_on_topic_id"
    t.index ["video_id"], name: "index_manuals_on_video_id"
  end

  create_table "mastra_agent_versions", id: :text, force: :cascade do |t|
    t.text "agentId", null: false
    t.integer "versionNumber", null: false
    t.text "name", null: false
    t.text "description"
    t.text "instructions", null: false
    t.jsonb "model", null: false
    t.jsonb "tools"
    t.jsonb "defaultOptions"
    t.jsonb "workflows"
    t.jsonb "agents"
    t.jsonb "integrationTools"
    t.jsonb "inputProcessors"
    t.jsonb "outputProcessors"
    t.jsonb "memory"
    t.jsonb "scorers"
    t.jsonb "changedFields"
    t.text "changeMessage"
    t.datetime "createdAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
  end

  create_table "mastra_agents", id: :text, force: :cascade do |t|
    t.text "status", null: false
    t.text "activeVersionId"
    t.text "authorId"
    t.jsonb "metadata"
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }
  end

  create_table "mastra_ai_spans", primary_key: ["traceId", "spanId"], force: :cascade do |t|
    t.text "traceId", null: false
    t.text "spanId", null: false
    t.text "name", null: false
    t.text "spanType", null: false
    t.boolean "isEvent", null: false
    t.datetime "startedAt", precision: nil, null: false
    t.text "parentSpanId"
    t.text "entityType"
    t.text "entityId"
    t.text "entityName"
    t.text "userId"
    t.text "organizationId"
    t.text "resourceId"
    t.text "runId"
    t.text "sessionId"
    t.text "threadId"
    t.text "requestId"
    t.text "environment"
    t.text "source"
    t.text "serviceName"
    t.jsonb "scope"
    t.jsonb "metadata"
    t.jsonb "tags"
    t.jsonb "attributes"
    t.jsonb "links"
    t.jsonb "input"
    t.jsonb "output"
    t.jsonb "error"
    t.datetime "endedAt", precision: nil
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil
    t.timestamptz "startedAtZ", default: -> { "now()" }
    t.timestamptz "endedAtZ", default: -> { "now()" }
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }
    t.index ["entityType", "entityId"], name: "mastra_ai_spans_entitytype_entityid_idx"
    t.index ["entityType", "entityName"], name: "mastra_ai_spans_entitytype_entityname_idx"
    t.index ["metadata"], name: "mastra_ai_spans_metadata_gin_idx", using: :gin
    t.index ["name"], name: "mastra_ai_spans_name_idx"
    t.index ["organizationId", "userId"], name: "mastra_ai_spans_orgid_userid_idx"
    t.index ["parentSpanId", "startedAt"], name: "mastra_ai_spans_parentspanid_startedat_idx", order: { startedAt: :desc }
    t.index ["spanType", "startedAt"], name: "mastra_ai_spans_spantype_startedat_idx", order: { startedAt: :desc }
    t.index ["startedAt"], name: "mastra_ai_spans_root_spans_idx", order: :desc, where: "(\"parentSpanId\" IS NULL)"
    t.index ["tags"], name: "mastra_ai_spans_tags_gin_idx", using: :gin
    t.index ["traceId", "startedAt"], name: "mastra_ai_spans_traceid_startedat_idx", order: { startedAt: :desc }
  end

  create_table "mastra_messages", id: :text, force: :cascade do |t|
    t.text "thread_id", null: false
    t.text "content", null: false
    t.text "role", null: false
    t.text "type", null: false
    t.datetime "createdAt", precision: nil, null: false
    t.text "resourceId"
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.index ["thread_id", "createdAt"], name: "mastra_messages_thread_id_createdat_idx", order: { createdAt: :desc }
  end

  create_table "mastra_resources", id: :text, force: :cascade do |t|
    t.text "workingMemory"
    t.jsonb "metadata"
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }
  end

  create_table "mastra_scorers", id: :text, force: :cascade do |t|
    t.text "scorerId", null: false
    t.text "traceId"
    t.text "spanId"
    t.text "runId", null: false
    t.jsonb "scorer", null: false
    t.jsonb "preprocessStepResult"
    t.jsonb "extractStepResult"
    t.jsonb "analyzeStepResult"
    t.float "score", null: false
    t.text "reason"
    t.jsonb "metadata"
    t.text "preprocessPrompt"
    t.text "extractPrompt"
    t.text "generateScorePrompt"
    t.text "generateReasonPrompt"
    t.text "analyzePrompt"
    t.text "reasonPrompt"
    t.jsonb "input", null: false
    t.jsonb "output", null: false
    t.jsonb "additionalContext"
    t.jsonb "requestContext"
    t.text "entityType"
    t.jsonb "entity"
    t.text "entityId"
    t.text "source", null: false
    t.text "resourceId"
    t.text "threadId"
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }
    t.index ["traceId", "spanId", "createdAt"], name: "mastra_scores_trace_id_span_id_created_at_idx", order: { createdAt: :desc }
  end

  create_table "mastra_threads", id: :text, force: :cascade do |t|
    t.text "resourceId", null: false
    t.text "title", null: false
    t.jsonb "metadata"
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }
    t.index ["resourceId", "createdAt"], name: "mastra_threads_resourceid_createdat_idx", order: { createdAt: :desc }
  end

  create_table "mastra_workflow_snapshot", id: false, force: :cascade do |t|
    t.text "workflow_name", null: false
    t.text "run_id", null: false
    t.text "resourceId"
    t.jsonb "snapshot", null: false
    t.datetime "createdAt", precision: nil, null: false
    t.datetime "updatedAt", precision: nil, null: false
    t.timestamptz "createdAtZ", default: -> { "now()" }
    t.timestamptz "updatedAtZ", default: -> { "now()" }

    t.unique_constraint ["workflow_name", "run_id"], name: "public_mastra_workflow_snapshot_workflow_name_run_id_key"
  end

  create_table "message_files", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "message_id", limit: 26, null: false
    t.string "file_path", null: false
    t.string "file_name", null: false
    t.string "content_type", null: false
    t.integer "file_size"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["message_id"], name: "index_message_files_on_message_id"
  end

  create_table "messages", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "topic_id", comment: "topic_id"
    t.string "request_id", comment: "requests_id"
    t.string "content", comment: "メッセージ内容"
    t.integer "message_type", default: 0, comment: "タイプ"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "chat_type", default: 0, comment: "チャットタイプ（hearing/validation）"
    t.string "question_id", comment: "関連するsystemメッセージのID（userメッセージの場合）"
    t.string "room_id"
    t.integer "pbm_step", comment: "このメッセージ時点の PBM ステップ"
    t.jsonb "meta_json", default: {}, comment: "LLM が出力した構造化メタデータ (HEARING_META)"
    t.index ["chat_type"], name: "index_messages_on_chat_type"
    t.index ["question_id"], name: "index_messages_on_question_id"
    t.index ["request_id"], name: "index_messages_on_request_id"
    t.index ["topic_id"], name: "index_messages_on_topic_id"
  end

  create_table "permissions", id: { type: :string, limit: 26 }, comment: "権限", force: :cascade do |t|
    t.string "company_id", limit: 26, null: false, comment: "会社ID"
    t.string "permissible_type", null: false, comment: "権限対象の型（TopicFolder, Topic, DataSourceFolder, DataSourceFile）"
    t.string "permissible_id", limit: 26, null: false, comment: "権限対象のID"
    t.string "grantee_type", null: false, comment: "権限付与先の型（Admin or User）"
    t.string "grantee_id", limit: 26, null: false, comment: "権限付与先のID"
    t.integer "role", default: 0, null: false, comment: "ロール（0:閲覧者, 1:編集者, 2:オーナー）"
    t.string "granted_by_id", limit: 26, comment: "権限付与者ID（Admin or null for User-granted）"
    t.datetime "deleted_at", comment: "削除日時"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id"], name: "index_permissions_on_company_id"
    t.index ["deleted_at"], name: "index_permissions_on_deleted_at"
    t.index ["grantee_type", "grantee_id"], name: "idx_perm_grantee"
    t.index ["permissible_type", "permissible_id", "grantee_type", "grantee_id"], name: "idx_perm_unique_grant", unique: true, where: "(deleted_at IS NULL)"
    t.index ["permissible_type", "permissible_id"], name: "idx_perm_permissible"
  end

  create_table "request_contents", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "request_id", null: false, comment: "リクエストID"
    t.text "context", comment: "コンテキスト"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "comment", comment: "コメント"
    t.index ["request_id"], name: "index_request_contents_on_request_id"
  end

  create_table "request_data_source_links", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "request_id", limit: 26, null: false
    t.string "data_source_file_id", limit: 26, null: false
    t.string "linked_by_id", limit: 26, null: false
    t.string "linked_by_type", null: false
    t.datetime "created_at", null: false
    t.index ["data_source_file_id"], name: "idx_rdsl_file"
    t.index ["request_id", "data_source_file_id"], name: "idx_rdsl_request_file_unique", unique: true
  end

  create_table "request_documents", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "request_id", null: false, comment: "リクエストID"
    t.text "key", comment: "キー"
    t.integer "status", default: 0, comment: "ステータス"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "batch_id"
    t.text "parsed_document_key", comment: "パース済みドキュメントのS3キー"
    t.integer "token_count", comment: "トークン数"
    t.string "file_type"
    t.index ["request_id"], name: "index_request_documents_on_request_id"
  end

  create_table "requests", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "topic_id", null: false, comment: "topic_id"
    t.integer "status", default: 0, comment: "ステータス"
    t.string "respondent_id", limit: 26, comment: "回答者"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者"
    t.datetime "deleted_at", comment: "削除日時"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "request_type", default: 0, null: false, comment: "リクエストタイプ（0:ヒアリング, 1:手動）"
    t.string "name", comment: "リクエスト名"
    t.text "description", comment: "説明"
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.index ["created_by_id"], name: "index_requests_on_created_by_id"
    t.index ["created_by_type", "created_by_id"], name: "idx_requests_created_by"
    t.index ["request_type"], name: "index_requests_on_request_type"
    t.index ["respondent_id"], name: "index_requests_on_respondent_id"
    t.index ["topic_id"], name: "index_requests_on_topic_id"
  end

  create_table "rooms", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "request_id", comment: "リクエストID"
    t.string "request_content_id", comment: "リクエストコンテンツID"
    t.string "chat_type", null: false, comment: "ルームタイプ（hearing/validation）"
    t.boolean "is_finished", default: false, null: false, comment: "完了フラグ"
    t.boolean "is_deleted", default: false, null: false, comment: "削除フラグ"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "topic_id", limit: 26, comment: "トピックID"
    t.index ["is_deleted"], name: "index_rooms_on_is_deleted"
    t.index ["is_finished"], name: "index_rooms_on_is_finished"
    t.index ["request_content_id"], name: "index_rooms_on_request_content_id"
    t.index ["request_id", "chat_type"], name: "index_rooms_on_request_id_and_chat_type"
    t.index ["topic_id"], name: "index_rooms_on_topic_id"
  end

  create_table "scraper_instances", id: :string, force: :cascade do |t|
    t.string "name", null: false
    t.string "host", null: false
    t.integer "port", default: 22
    t.string "ssh_user", default: "ec2-user"
    t.string "ssh_key_secret_id"
    t.string "status", default: "active", null: false
    t.string "account_id"
    t.string "region"
    t.string "runtime", default: "docker"
    t.integer "max_concurrency", default: 2
    t.integer "current_tasks", default: 0
    t.jsonb "resource_thresholds", default: {"cpu_max" => 70, "memory_max" => 85, "network_max_mbps" => 100}
    t.jsonb "last_resource_check"
    t.datetime "last_checked_at"
    t.jsonb "capabilities", default: ["web_scrape", "csv_download", "pdf_download", "api"]
    t.jsonb "tags", default: {}
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_scraper_instances_on_name", unique: true
    t.index ["status"], name: "index_scraper_instances_on_status"
  end

  create_table "topic_data_source_links", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "topic_id", limit: 26, null: false
    t.string "data_source_file_id", limit: 26, null: false
    t.string "linked_by_id", limit: 26, null: false
    t.string "linked_by_type", null: false
    t.datetime "created_at", null: false
    t.index ["data_source_file_id"], name: "idx_tdsl_file"
    t.index ["linked_by_type", "linked_by_id"], name: "idx_tdsl_linked_by"
    t.index ["topic_id", "data_source_file_id"], name: "idx_tdsl_topic_file_unique", unique: true
  end

  create_table "topic_folders", id: { type: :string, limit: 26 }, comment: "トピックフォルダ", force: :cascade do |t|
    t.string "company_id", limit: 26, null: false, comment: "会社ID"
    t.string "parent_id", limit: 26, comment: "親フォルダID"
    t.string "name", null: false, comment: "フォルダ名"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者ID"
    t.datetime "deleted_at", comment: "削除日時"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.index ["company_id", "parent_id"], name: "idx_topic_folders_company_parent"
    t.index ["created_by_type", "created_by_id"], name: "idx_topic_folders_created_by"
    t.index ["deleted_at"], name: "index_topic_folders_on_deleted_at"
    t.index ["parent_id"], name: "index_topic_folders_on_parent_id"
  end

  create_table "topics", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "name", comment: "トピック名"
    t.string "description", comment: "説明"
    t.string "created_by_id", limit: 26, null: false, comment: "作成者"
    t.datetime "deleted_at", comment: "削除日時"
    t.string "uuid", comment: "UUID"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "summary", comment: "概要"
    t.integer "status", default: 0, comment: "ステータス"
    t.string "company_id", limit: 26
    t.string "folder_id", limit: 26, comment: "フォルダID"
    t.string "created_by_type", null: false, comment: "作成者の型（Admin or User）"
    t.integer "icon_color", comment: "アイコンの色指定"
    t.index ["company_id", "folder_id"], name: "idx_topics_company_folder"
    t.index ["company_id"], name: "index_topics_on_company_id"
    t.index ["created_by_id"], name: "index_topics_on_created_by_id"
    t.index ["created_by_type", "created_by_id"], name: "idx_topics_created_by"
    t.index ["folder_id"], name: "index_topics_on_folder_id"
    t.index ["uuid"], name: "index_topics_on_uuid", unique: true
  end

  create_table "transcriptions", id: { type: :string, limit: 26 }, comment: "字幕保存", force: :cascade do |t|
    t.string "manual_id", limit: 26, null: false, comment: "マニュアルID"
    t.integer "sequence", null: false, comment: "字幕表示連番"
    t.decimal "start_second", precision: 10, scale: 3, null: false, comment: "開始時間(秒)"
    t.decimal "end_second", precision: 10, scale: 3, null: false, comment: "終了時間(秒)"
    t.text "text", null: false, comment: "字幕テキスト"
    t.string "speaker", comment: "発話者"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "request_document_id", limit: 26, comment: "動画ドキュメントID"
    t.index ["manual_id"], name: "index_transcriptions_on_manual_id"
    t.index ["request_document_id"], name: "index_transcriptions_on_request_document_id"
  end

  create_table "user_group_memberships", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "user_group_id", limit: 26, null: false
    t.string "user_id", limit: 26, null: false
    t.datetime "deleted_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["deleted_at"], name: "index_user_group_memberships_on_deleted_at"
    t.index ["user_group_id", "user_id", "deleted_at"], name: "idx_ugm_unique_membership", unique: true
    t.index ["user_group_id"], name: "index_user_group_memberships_on_user_group_id"
    t.index ["user_id"], name: "index_user_group_memberships_on_user_id"
  end

  create_table "user_groups", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "company_id", limit: 26, null: false
    t.string "name", null: false
    t.text "description"
    t.string "created_by_type", null: false
    t.string "created_by_id", limit: 26, null: false
    t.datetime "deleted_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_id", "name", "deleted_at"], name: "idx_user_groups_unique_name", unique: true
    t.index ["company_id"], name: "index_user_groups_on_company_id"
    t.index ["deleted_at"], name: "index_user_groups_on_deleted_at"
  end

  create_table "users", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "name", comment: "熱練者名"
    t.string "email", comment: "メールアドレス"
    t.string "department", comment: "所属部署"
    t.string "number", comment: "勤続年数"
    t.text "description", comment: "社内経歴"
    t.string "password_digest", comment: "パスワード"
    t.datetime "deleted_at", comment: "削除日時"
    t.integer "status", default: 0, comment: "ステータス"
    t.string "session_token", comment: "セッショントークン"
    t.text "note", comment: "メモ"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "company_id", limit: 26
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.integer "role", default: 1, null: false, comment: "権限. 0=一般, 1=熟練者, 9=管理者"
    t.string "creator_type", null: false, comment: "作成者の型（Admin or User）"
    t.string "creator_id", limit: 26, null: false, comment: "作成者のID"
    t.index ["company_id"], name: "index_users_on_company_id"
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["creator_type", "creator_id"], name: "index_users_on_creator_type_and_creator_id"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "admins", "companies", on_delete: :nullify
  add_foreign_key "bias_flags", "messages", column: "source_message_id", on_delete: :nullify
  add_foreign_key "bias_flags", "requests", on_delete: :cascade
  add_foreign_key "chapters", "manuals"
  add_foreign_key "chapters", "request_documents"
  add_foreign_key "company_glossary_terms", "companies", on_delete: :cascade
  add_foreign_key "comparison_elements", "comparison_sessions", on_delete: :cascade
  add_foreign_key "comparison_sessions", "topics", column: "merged_topic_id", on_delete: :nullify
  add_foreign_key "comparison_sessions", "topics", on_delete: :cascade
  add_foreign_key "data_acquisition_job_runs", "data_acquisition_jobs", column: "job_id"
  add_foreign_key "data_acquisition_jobs", "companies", on_delete: :cascade
  add_foreign_key "data_acquisition_records", "companies", on_delete: :cascade
  add_foreign_key "data_acquisition_records", "data_acquisition_jobs", column: "job_id"
  add_foreign_key "data_acquisition_tasks", "data_acquisition_job_runs", column: "run_id"
  add_foreign_key "data_acquisition_tasks", "data_acquisition_jobs", column: "job_id"
  add_foreign_key "data_source_files", "companies", on_delete: :cascade
  add_foreign_key "data_source_files", "data_source_folders", column: "folder_id", on_delete: :nullify
  add_foreign_key "data_source_folders", "companies", on_delete: :cascade
  add_foreign_key "data_source_folders", "data_source_folders", column: "parent_id", on_delete: :cascade
  add_foreign_key "hearing_extracts", "messages", column: "source_message_id", on_delete: :nullify
  add_foreign_key "hearing_extracts", "requests", on_delete: :cascade
  add_foreign_key "hearing_step_states", "requests", on_delete: :cascade
  add_foreign_key "hearing_suggestions", "requests", on_delete: :cascade
  add_foreign_key "manual_templates", "companies", on_delete: :cascade
  add_foreign_key "manuals", "manual_templates", on_delete: :nullify
  add_foreign_key "manuals", "request_documents", column: "video_id"
  add_foreign_key "manuals", "requests"
  add_foreign_key "manuals", "topics"
  add_foreign_key "message_files", "messages", on_delete: :cascade
  add_foreign_key "messages", "requests"
  add_foreign_key "messages", "topics"
  add_foreign_key "permissions", "admins", column: "granted_by_id"
  add_foreign_key "permissions", "companies", on_delete: :cascade
  add_foreign_key "request_data_source_links", "data_source_files", on_delete: :cascade
  add_foreign_key "request_data_source_links", "requests", on_delete: :cascade
  add_foreign_key "requests", "topics"
  add_foreign_key "requests", "users", column: "respondent_id"
  add_foreign_key "rooms", "request_contents"
  add_foreign_key "rooms", "requests"
  add_foreign_key "rooms", "topics", on_delete: :cascade
  add_foreign_key "topic_data_source_links", "data_source_files", on_delete: :cascade
  add_foreign_key "topic_data_source_links", "topics", on_delete: :cascade
  add_foreign_key "topic_folders", "companies", on_delete: :cascade
  add_foreign_key "topic_folders", "topic_folders", column: "parent_id", on_delete: :cascade
  add_foreign_key "topics", "companies", on_delete: :nullify
  add_foreign_key "topics", "topic_folders", column: "folder_id", on_delete: :nullify
  add_foreign_key "transcriptions", "manuals"
  add_foreign_key "transcriptions", "request_documents"
  add_foreign_key "users", "companies", on_delete: :nullify
end
