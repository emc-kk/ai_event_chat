class CreateDataSourceFiles < ActiveRecord::Migration[8.0]
  def change
    create_table :data_source_files, id: { type: :string, limit: 26 } do |t|
      t.string :company_id, limit: 26, null: false, comment: "会社ID"
      t.string :folder_id, limit: 26, comment: "フォルダID"
      t.string :name, null: false, comment: "ファイル名"
      t.text :key, null: false, comment: "S3キー"
      t.string :file_type, comment: "ファイル種別 (pdf, xlsx, docx, pptx等)"
      t.bigint :file_size, comment: "ファイルサイズ（バイト）"
      t.integer :ai_status, default: 0, null: false, comment: "AI学習状態 (0=pending, 1=processing, 2=completed, 3=failed)"
      t.integer :token_count, comment: "トークン数"
      t.text :parsed_doc_key, comment: "パース済みドキュメントのS3キー"
      t.string :created_by_id, limit: 26, null: false, comment: "作成者ID"
      t.string :updated_by_id, limit: 26, comment: "更新者ID"
      t.datetime :deleted_at, comment: "削除日時"
      t.timestamps
    end

    add_index :data_source_files, [:company_id, :folder_id], name: "idx_ds_files_company_folder"
    add_index :data_source_files, :folder_id
    add_index :data_source_files, :ai_status
    add_index :data_source_files, :deleted_at

    add_foreign_key :data_source_files, :companies, on_delete: :cascade
    add_foreign_key :data_source_files, :data_source_folders, column: :folder_id, on_delete: :nullify
  end
end
