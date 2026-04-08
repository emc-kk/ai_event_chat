class CreateRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :requests, id: :string, limit: 26 do |t|
      t.string :room_id, null: false, comment: "チャットルームID"
      t.string :validation_room_id, null: false, comment: "検証用チャットルームID"
      t.references :topic, null: false, foreign_key: true, type: :string, comment: "topic_id"
      t.integer :status, default: 0, comment: "ステータス"
      t.references :respondent, null: false, foreign_key: { to_table: :users }, type: :string, limit: 26, comment: "回答者"
      t.references :created_by, null: false, foreign_key: { to_table: :admins }, type: :string, limit: 26, comment: "作成者"
      t.string :description, comment: "説明"
      t.datetime :deleted_at, comment: "削除日時"

      t.timestamps
    end

    add_index :requests, :room_id, unique: true
    add_index :requests, :validation_room_id, unique: true
  end
end
