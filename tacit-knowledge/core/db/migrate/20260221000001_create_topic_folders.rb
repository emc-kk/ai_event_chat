class CreateTopicFolders < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_folders, id: { type: :string, limit: 26 }, comment: "トピックフォルダ" do |t|
      t.string :company_id, limit: 26, null: false, comment: "会社ID"
      t.string :parent_id, limit: 26, comment: "親フォルダID"
      t.string :name, null: false, comment: "フォルダ名"
      t.string :created_by_id, limit: 26, null: false, comment: "作成者ID"
      t.datetime :deleted_at, comment: "削除日時"
      t.timestamps
    end

    add_index :topic_folders, [:company_id, :parent_id], name: "idx_topic_folders_company_parent"
    add_index :topic_folders, :parent_id
    add_index :topic_folders, :deleted_at

    add_foreign_key :topic_folders, :companies, on_delete: :cascade
    add_foreign_key :topic_folders, :topic_folders, column: :parent_id, on_delete: :cascade
    add_foreign_key :topic_folders, :admins, column: :created_by_id
  end
end
