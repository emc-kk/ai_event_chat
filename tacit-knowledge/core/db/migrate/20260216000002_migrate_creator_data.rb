class MigrateCreatorData < ActiveRecord::Migration[8.0]
  def up
    # 既存のcreated_byを新しいカラムにコピー
    execute <<-SQL
      UPDATE users
      SET creator_type = 'Admin',
          creator_id = created_by
      WHERE created_by IS NOT NULL;
    SQL
  end

  def down
    # ロールバック時は新しいカラムをクリア
    execute "UPDATE users SET creator_type = NULL, creator_id = NULL"
  end
end
