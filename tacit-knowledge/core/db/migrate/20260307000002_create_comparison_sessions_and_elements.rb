class CreateComparisonSessionsAndElements < ActiveRecord::Migration[8.0]
  def change
    create_table :comparison_sessions, id: { type: :string, limit: 26 }, comment: "ベテラン知識比較セッション" do |t|
      t.string :topic_id, limit: 26, null: false, comment: "対象トピックID"
      t.jsonb :request_ids, null: false, default: [], comment: "比較対象のヒアリングリクエストID群"
      t.integer :status, default: 0, null: false, comment: "ステータス (0=analyzing, 1=in_review, 2=completed)"
      t.decimal :consensus_rate, precision: 5, scale: 4, comment: "知識一致率 (0.0〜1.0)"
      t.string :merged_topic_id, limit: 26, comment: "統合ナレッジ生成後の参照先Topic ID"
      t.string :created_by_id, limit: 26, null: false, comment: "作成者ID"
      t.string :created_by_type, null: false, comment: "作成者の型（Admin or User）"
      t.timestamps
    end

    add_index :comparison_sessions, :topic_id
    add_index :comparison_sessions, :status
    add_foreign_key :comparison_sessions, :topics, on_delete: :cascade
    add_foreign_key :comparison_sessions, :topics, column: :merged_topic_id, on_delete: :nullify

    create_table :comparison_elements, id: { type: :string, limit: 26 }, comment: "比較要素" do |t|
      t.string :comparison_session_id, limit: 26, null: false, comment: "所属する比較セッションID"
      t.integer :classification, null: false, comment: "分類 (0=consensus, 1=divergence, 2=gap)"
      t.text :knowledge_element, null: false, comment: "比較対象の知識要素の要約"
      t.jsonb :responses, null: false, default: [], comment: "[{request_id, respondent_name, content}] ベテランごとの回答"
      t.integer :resolution, comment: "解決方法 (0=adopted, 1=merged_condition, 2=flagged)"
      t.jsonb :resolution_detail, comment: "採用したrequest_id、条件分岐の記述、フラグ理由などの詳細"
      t.text :resolution_comment, comment: "意思決定の理由コメント（任意）"
      t.timestamps
    end

    add_index :comparison_elements, :comparison_session_id
    add_index :comparison_elements, :classification
    add_foreign_key :comparison_elements, :comparison_sessions, on_delete: :cascade
  end
end
