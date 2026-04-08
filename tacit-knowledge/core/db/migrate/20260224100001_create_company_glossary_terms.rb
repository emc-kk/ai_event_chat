class CreateCompanyGlossaryTerms < ActiveRecord::Migration[8.0]
  def change
    create_table :company_glossary_terms, id: { type: :string, limit: 26 }, comment: "社内辞書" do |t|
      t.string :company_id, limit: 26, null: false, comment: "会社ID"
      t.string :term, null: false, comment: "用語"
      t.text :definition, null: false, comment: "定義"
      t.string :created_by_id, limit: 26, null: false, comment: "作成者ID"
      t.string :created_by_type, null: false, comment: "作成者の型（Admin or User）"
      t.string :updated_by_id, limit: 26, comment: "更新者ID"
      t.string :updated_by_type, comment: "更新者の型（Admin or User）"
      t.timestamps
    end

    add_index :company_glossary_terms, [:company_id, :term], unique: true, name: "idx_glossary_company_term_unique"
    add_index :company_glossary_terms, :company_id, name: "idx_glossary_company"
    add_index :company_glossary_terms, [:created_by_type, :created_by_id], name: "idx_glossary_created_by"

    add_foreign_key :company_glossary_terms, :companies, on_delete: :cascade
  end
end
