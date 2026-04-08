class SetCategoryOnIso9001Templates < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL
      UPDATE manual_templates
      SET category = 'iso9001'
      WHERE is_preset = TRUE
        AND name IN ('ISO9001 作業手順書', 'ISO9001 検査基準書')
        AND category IS NULL
    SQL
  end

  def down
    execute <<~SQL
      UPDATE manual_templates
      SET category = NULL
      WHERE is_preset = TRUE
        AND name IN ('ISO9001 作業手順書', 'ISO9001 検査基準書')
        AND category = 'iso9001'
    SQL
  end
end
