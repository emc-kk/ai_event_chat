class CreateTopicDataSourceLinks < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_data_source_links, id: { type: :string, limit: 26 } do |t|
      t.string :topic_id, limit: 26, null: false
      t.string :data_source_file_id, limit: 26, null: false
      t.string :linked_by_id, limit: 26, null: false
      t.string :linked_by_type, null: false
      t.datetime :created_at, null: false
    end

    add_index :topic_data_source_links, [:topic_id, :data_source_file_id],
              unique: true, name: "idx_tdsl_topic_file_unique"
    add_index :topic_data_source_links, :data_source_file_id, name: "idx_tdsl_file"
    add_index :topic_data_source_links, [:linked_by_type, :linked_by_id], name: "idx_tdsl_linked_by"

    add_foreign_key :topic_data_source_links, :topics, on_delete: :cascade
    add_foreign_key :topic_data_source_links, :data_source_files, on_delete: :cascade
  end
end
