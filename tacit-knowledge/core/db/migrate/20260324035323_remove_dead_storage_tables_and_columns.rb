class RemoveDeadStorageTablesAndColumns < ActiveRecord::Migration[8.0]
  def up
    # ActiveStorageデッドテーブル削除
    drop_table :active_storage_variant_records, if_exists: true
    drop_table :active_storage_attachments, if_exists: true
    drop_table :active_storage_blobs, if_exists: true

    # message_filesテーブル削除（レコード未使用）
    drop_table :message_files, if_exists: true

    # requests.chart_pathデッドカラム削除
    remove_column :requests, :chart_path, :string, if_exists: true
  end

  def down
    create_table :active_storage_blobs, id: :primary_key do |t|
      t.string :key, null: false
      t.string :filename, null: false
      t.string :content_type
      t.text :metadata
      t.string :service_name, null: false
      t.bigint :byte_size, null: false
      t.string :checksum
      t.timestamps
    end
    add_index :active_storage_blobs, [:key], unique: true

    create_table :active_storage_attachments do |t|
      t.string :name, null: false
      t.references :record, null: false, polymorphic: true, index: false
      t.references :blob, null: false
      t.timestamps
    end
    add_index :active_storage_attachments, [:record_type, :record_id, :name, :blob_id],
              name: "index_active_storage_attachments_uniqueness", unique: true
    add_foreign_key :active_storage_attachments, :active_storage_blobs, column: :blob_id

    create_table :active_storage_variant_records do |t|
      t.belongs_to :blob, null: false, index: false
      t.string :variation_digest, null: false
    end
    add_index :active_storage_variant_records, [:blob_id, :variation_digest],
              name: "index_active_storage_variant_records_uniqueness", unique: true
    add_foreign_key :active_storage_variant_records, :active_storage_blobs, column: :blob_id

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

    add_column :requests, :chart_path, :string
  end
end
