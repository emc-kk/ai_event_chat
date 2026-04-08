class AddPolymorphicCreatedByToDataSourceFolders < ActiveRecord::Migration[8.0]
  def change
    # 1. 型カラムを追加
    add_column :data_source_folders, :created_by_type, :string,
               comment: "作成者の型（Admin or User）"

    # 2. 既存データを Admin として埋める
    reversible do |dir|
      dir.up { execute "UPDATE data_source_folders SET created_by_type = 'Admin'" }
    end

    # 3. NOT NULL 制約を付与
    change_column_null :data_source_folders, :created_by_type, false

    # 4. 複合インデックスを追加
    add_index :data_source_folders, [:created_by_type, :created_by_id],
              name: "idx_ds_folders_created_by"
  end
end
