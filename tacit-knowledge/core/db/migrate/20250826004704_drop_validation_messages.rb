class DropValidationMessages < ActiveRecord::Migration[8.0]
  def change
    drop_table :validation_messages do |t|
      t.string "uuid", comment: "uuid"
      t.string "topic_id", null: false, comment: "topic_id"
      t.string "content", comment: "メッセージ内容"
      t.integer "message_type", default: 0, comment: "タイプ"
      t.string "sender_id", limit: 26, null: false, comment: "送信者ID"
      t.datetime "created_at", null: false
      t.datetime "updated_at", null: false
      t.index ["sender_id"], name: "index_validation_messages_on_sender_id"
      t.index ["topic_id"], name: "index_validation_messages_on_topic_id"
      t.index ["uuid"], name: "index_validation_messages_on_uuid", unique: true
    end
  end
end
