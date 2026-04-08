class AddFolderIdToTopics < ActiveRecord::Migration[8.0]
  def change
    add_column :topics, :folder_id, :string, limit: 26, comment: "フォルダID"

    add_index :topics, :folder_id
    add_index :topics, [:company_id, :folder_id], name: "idx_topics_company_folder"

    add_foreign_key :topics, :topic_folders, column: :folder_id, on_delete: :nullify
  end
end
