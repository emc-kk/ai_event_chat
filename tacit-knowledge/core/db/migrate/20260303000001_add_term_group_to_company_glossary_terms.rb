class AddTermGroupToCompanyGlossaryTerms < ActiveRecord::Migration[8.0]
  def change
    add_column :company_glossary_terms, :term_group, :string, comment: "用語グループ"
    add_index :company_glossary_terms, [:company_id, :term_group], name: "idx_glossary_company_term_group"
  end
end
