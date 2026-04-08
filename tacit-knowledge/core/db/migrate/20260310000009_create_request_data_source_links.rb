class CreateRequestDataSourceLinks < ActiveRecord::Migration[7.2]
  def change
    create_table :request_data_source_links, id: { type: :string, limit: 26 }, if_not_exists: true do |t|
      t.string :request_id, limit: 26, null: false
      t.string :data_source_file_id, limit: 26, null: false
      t.string :linked_by_id, limit: 26, null: false
      t.string :linked_by_type, null: false
      t.datetime :created_at, null: false
    end

    unless index_exists?(:request_data_source_links, [:request_id, :data_source_file_id])
      add_index :request_data_source_links, [:request_id, :data_source_file_id],
                unique: true, name: "idx_rdsl_request_file_unique"
    end
    unless index_exists?(:request_data_source_links, :data_source_file_id)
      add_index :request_data_source_links, :data_source_file_id, name: "idx_rdsl_file"
    end

    unless foreign_key_exists?(:request_data_source_links, :requests)
      add_foreign_key :request_data_source_links, :requests, on_delete: :cascade
    end
    unless foreign_key_exists?(:request_data_source_links, :data_source_files)
      add_foreign_key :request_data_source_links, :data_source_files, on_delete: :cascade
    end
  end
end
