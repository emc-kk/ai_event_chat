class AddPolymorphicCreatedByToDataSourceFiles < ActiveRecord::Migration[8.0]
  def change
    # 1. 型カラムを追加
    add_column :data_source_files, :created_by_type, :string,
               comment: "作成者の型（Admin or User）"
    add_column :data_source_files, :updated_by_type, :string,
               comment: "更新者の型（Admin or User）"

    # 2. 既存データを Admin として埋める
    reversible do |dir|
      dir.up do
        execute "UPDATE data_source_files SET created_by_type = 'Admin'"
        execute "UPDATE data_source_files SET updated_by_type = 'Admin' WHERE updated_by_id IS NOT NULL"
      end
    end

    # 3. created_by_type に NOT NULL 制約を付与
    change_column_null :data_source_files, :created_by_type, false

    # 4. 複合インデックスを追加
    add_index :data_source_files, [:created_by_type, :created_by_id],
              name: "idx_ds_files_created_by"
    add_index :data_source_files, [:updated_by_type, :updated_by_id],
              name: "idx_ds_files_updated_by"
  end
end
