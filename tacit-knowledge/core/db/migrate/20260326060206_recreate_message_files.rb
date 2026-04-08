class RecreateMessageFiles < ActiveRecord::Migration[8.0]
  def up
    return if table_exists?(:message_files)

    create_table :message_files, id: { type: :string, limit: 26 } do |t|
      t.string :message_id, limit: 26, null: false
      t.string :file_path, null: false
      t.string :file_name, null: false
      t.string :content_type, null: false
      t.integer :file_size
      t.timestamps
    end
    add_index :message_files, :message_id
    add_foreign_key :message_files, :messages, column: :message_id, on_delete: :cascade
  end

  def down
    drop_table :message_files, if_exists: true
  end
end
