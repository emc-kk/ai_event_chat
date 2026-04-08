class CreateMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :messages, id: :string, limit: 26 do |t|
      t.string :uuid, comment: "uuid"
      t.references :topic, null: false, foreign_key: true, type: :string, comment: "topic_id"
      t.references :request, null: false, foreign_key: true, type: :string, comment: "requests_id"
      t.string :content, comment: "メッセージ内容"
      t.integer :message_type, default: 0, comment: "タイプ"
      t.references :user, null: false, foreign_key: true, type: :string, comment: "送信者ID"

      t.timestamps
    end

    add_index :messages, :uuid, unique: true
  end
end
