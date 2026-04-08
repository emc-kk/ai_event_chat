class CreateMessageFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :message_files, id: { type: :string, limit: 26 } do |t|
      t.string :message_id, limit: 26, null: false, comment: "メッセージID"
      t.string :file_path, null: false, comment: "S3ファイルパス"
      t.string :file_name, null: false, comment: "ファイル名"
      t.string :content_type, null: false, comment: "コンテンツタイプ"
      t.integer :file_size, comment: "ファイルサイズ（バイト）"
      t.timestamps
    end

    add_index :message_files, :message_id
    add_foreign_key :message_files, :messages, column: :message_id, on_delete: :cascade
  end
end
