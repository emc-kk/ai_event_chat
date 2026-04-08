class RenameTopicPermissionsToPermissions < ActiveRecord::Migration[8.0]
  def change
    rename_table :topic_permissions, :permissions

    change_table_comment :permissions, from: "トピック権限", to: "権限"

    change_column_comment :permissions, :permissible_type,
      from: "権限対象の型（TopicFolder or Topic）",
      to: "権限対象の型（TopicFolder, Topic, DataSourceFolder, DataSourceFile）"

    # Rails rename_table automatically renames indexes matching the old table name pattern.
    # Manually rename only custom-named indexes that Rails won't auto-rename.
    rename_index :permissions, "idx_topic_perm_grantee", "idx_perm_grantee"
    rename_index :permissions, "idx_topic_perm_permissible", "idx_perm_permissible"
    rename_index :permissions, "idx_topic_perm_unique_grant", "idx_perm_unique_grant"
  end
end
