class CreateUserGroups < ActiveRecord::Migration[7.1]
  def change
    create_table :user_groups, id: { type: :string, limit: 26 } do |t|
      t.string :company_id, limit: 26, null: false
      t.string :name, null: false
      t.text :description
      t.string :created_by_type, null: false
      t.string :created_by_id, limit: 26, null: false
      t.datetime :deleted_at

      t.timestamps
    end

    add_index :user_groups, :company_id
    add_index :user_groups, [:company_id, :name, :deleted_at], unique: true, name: "idx_user_groups_unique_name"
    add_index :user_groups, :deleted_at
  end
end
