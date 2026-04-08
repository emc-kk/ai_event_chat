class CreateUserGroupMemberships < ActiveRecord::Migration[7.1]
  def change
    create_table :user_group_memberships, id: { type: :string, limit: 26 } do |t|
      t.string :user_group_id, limit: 26, null: false
      t.string :user_id, limit: 26, null: false
      t.datetime :deleted_at

      t.timestamps
    end

    add_index :user_group_memberships, :user_group_id
    add_index :user_group_memberships, :user_id
    add_index :user_group_memberships, [:user_group_id, :user_id, :deleted_at], unique: true, name: "idx_ugm_unique_membership"
    add_index :user_group_memberships, :deleted_at
  end
end
