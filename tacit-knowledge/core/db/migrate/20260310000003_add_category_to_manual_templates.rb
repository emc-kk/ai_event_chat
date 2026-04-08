class AddCategoryToManualTemplates < ActiveRecord::Migration[8.0]
  def change
    add_column :manual_templates, :category, :string, comment: "テンプレートカテゴリ（例: iso9001）。nilの場合は汎用プリセット"
    add_index :manual_templates, :category

    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE manual_templates
          SET category = 'iso9001'
          WHERE is_preset = TRUE
            AND name IN ('ISO9001 作業手順書', 'ISO9001 検査基準書')
            AND category IS NULL
        SQL
      end
    end
  end
end
