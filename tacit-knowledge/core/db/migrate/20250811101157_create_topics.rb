class CreateTopics < ActiveRecord::Migration[8.0]
  def change
    create_table :topics, id: :string, limit: 26 do |t|
      t.string :name, comment: "トピック名"
      t.string :description, comment: "説明"
      t.references :created_by, null: false, foreign_key: { to_table: :admins }, type: :string, limit: 26, comment: "作成者"
      t.datetime :deleted_at, comment: "削除日時"
      t.string :uuid, comment: "UUID"

      t.timestamps
    end
    
    add_index :topics, :uuid, unique: true
  end
end
