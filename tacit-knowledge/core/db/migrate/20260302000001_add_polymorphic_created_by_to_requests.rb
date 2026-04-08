class AddPolymorphicCreatedByToRequests < ActiveRecord::Migration[8.0]
  def change
    # 1. 旧外部キー制約を削除（admins テーブルへの FK）
    remove_foreign_key :requests, :admins, column: :created_by_id

    # 2. 型カラムを追加（nullable で追加後に既存データを埋めてから NOT NULL に変更）
    add_column :requests, :created_by_type, :string,
               comment: "作成者の型（Admin or User）"

    # 3. 既存データを Admin として埋める（現在は Admin のみが作成者）
    reversible do |dir|
      dir.up { execute "UPDATE requests SET created_by_type = 'Admin'" }
    end

    # 4. NOT NULL 制約を付与
    change_column_null :requests, :created_by_type, false

    # 5. 複合インデックスを追加（ポリモーフィック検索の性能確保）
    add_index :requests, [:created_by_type, :created_by_id],
              name: "idx_requests_created_by"
  end
end
