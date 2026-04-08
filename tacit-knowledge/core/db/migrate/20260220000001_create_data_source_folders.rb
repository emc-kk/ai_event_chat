class CreateDataSourceFolders < ActiveRecord::Migration[8.0]
  def change
    create_table :data_source_folders, id: { type: :string, limit: 26 } do |t|
      t.string :company_id, limit: 26, null: false, comment: "会社ID"
      t.string :parent_id, limit: 26, comment: "親フォルダID"
      t.string :name, null: false, comment: "フォルダ名"
      t.string :created_by_id, limit: 26, null: false, comment: "作成者ID"
      t.datetime :deleted_at, comment: "削除日時"
      t.timestamps
    end

    add_index :data_source_folders, [:company_id, :parent_id], name: "idx_ds_folders_company_parent"
    add_index :data_source_folders, :parent_id
    add_index :data_source_folders, :deleted_at

    add_foreign_key :data_source_folders, :companies, on_delete: :cascade
    add_foreign_key :data_source_folders, :data_source_folders, column: :parent_id, on_delete: :cascade
  end
end
