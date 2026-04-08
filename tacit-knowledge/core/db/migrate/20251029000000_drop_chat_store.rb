class DropChatStore < ActiveRecord::Migration[7.0]
  def up
    drop_table :chat_store, if_exists: true
  end

  def down
    create_table :chat_store do |t|
      t.string :key, null: false, limit: 255
      t.jsonb :message, null: false
      t.timestamp :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }
    end

    add_index :chat_store, :key, name: 'idx_chat_store_key'
    add_index :chat_store, [:key, :created_at], order: { created_at: :desc }, name: 'idx_chat_store_key_created'
  end
end

