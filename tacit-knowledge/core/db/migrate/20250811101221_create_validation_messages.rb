class CreateValidationMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :validation_messages, id: :string, limit: 26 do |t|
      t.string :uuid, comment: "uuid"
      t.references :topic, null: false, foreign_key: true, type: :string, comment: "topic_id"
      t.string :content, comment: "メッセージ内容"
      t.integer :message_type, default: 0, comment: "タイプ"
      t.references :sender, null: false, foreign_key: { to_table: :admins }, type: :string, limit: 26, comment: "送信者ID"

      t.timestamps
    end

    add_index :validation_messages, :uuid, unique: true
  end
end
