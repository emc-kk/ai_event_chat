class CreateTopicPermissions < ActiveRecord::Migration[8.0]
  def change
    create_table :topic_permissions, id: { type: :string, limit: 26 }, comment: "トピック権限" do |t|
      t.string :company_id, limit: 26, null: false, comment: "会社ID"
      t.string :permissible_type, null: false, comment: "権限対象の型（TopicFolder or Topic）"
      t.string :permissible_id, limit: 26, null: false, comment: "権限対象のID"
      t.string :grantee_type, null: false, comment: "権限付与先の型（Admin or User）"
      t.string :grantee_id, limit: 26, null: false, comment: "権限付与先のID"
      t.integer :role, default: 0, null: false, comment: "ロール（0:閲覧者, 1:編集者, 2:オーナー）"
      t.string :granted_by_id, limit: 26, comment: "権限付与者ID（Admin or null for User-granted）"
      t.datetime :deleted_at, comment: "削除日時"
      t.timestamps
    end

    # 同一対象・同一ユーザーの重複防止
    add_index :topic_permissions, [:permissible_type, :permissible_id, :grantee_type, :grantee_id],
              unique: true, where: "deleted_at IS NULL",
              name: "idx_topic_perm_unique_grant"

    # 対象ごとの権限一覧取得用
    add_index :topic_permissions, [:permissible_type, :permissible_id],
              name: "idx_topic_perm_permissible"

    # ユーザーごとの権限一覧取得用
    add_index :topic_permissions, [:grantee_type, :grantee_id],
              name: "idx_topic_perm_grantee"

    # 会社スコープ
    add_index :topic_permissions, :company_id
    add_index :topic_permissions, :deleted_at

    # 外部キー
    add_foreign_key :topic_permissions, :companies, on_delete: :cascade
    add_foreign_key :topic_permissions, :admins, column: :granted_by_id
  end
end
