class AddForeignKeyUsersCreatedByToAdmins < ActiveRecord::Migration[8.0]
  def change
    change_column :users, :created_by, :string, limit: 26, null: false
    add_foreign_key :users, :admins, column: :created_by
  end
end
