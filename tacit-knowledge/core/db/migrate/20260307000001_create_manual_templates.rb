class CreateManualTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :manual_templates, id: { type: :string, limit: 26 }, comment: "マニュアルテンプレート" do |t|
      t.string :company_id, limit: 26, comment: "テナントID（プリセットの場合はnull）"
      t.string :name, null: false, comment: "テンプレート名"
      t.text :description, comment: "テンプレートの用途・概要"
      t.jsonb :sections, null: false, default: [], comment: "セクション定義 [{name, instruction}]"
      t.text :generation_prompt, comment: "生成プロンプト（変数埋め込み可: {{topic_name}}, {{knowledge_data}}, {{sections}}）"
      t.integer :output_format, default: 0, null: false, comment: "出力形式 (0=markdown, 1=docx)"
      t.boolean :is_preset, default: false, null: false, comment: "プリセットテンプレートか否か"
      t.string :created_by_id, limit: 26, comment: "作成者ID"
      t.string :created_by_type, comment: "作成者の型（Admin or User）"
      t.timestamps
    end

    add_index :manual_templates, :company_id
    add_index :manual_templates, :is_preset
    add_foreign_key :manual_templates, :companies, on_delete: :cascade

    # manualにテンプレート参照を追加
    add_column :manuals, :manual_template_id, :string, limit: 26, comment: "使用したテンプレートID"
    add_index :manuals, :manual_template_id
    add_foreign_key :manuals, :manual_templates, on_delete: :nullify
  end
end
