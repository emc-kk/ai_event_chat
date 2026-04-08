class RemoveOldCreatorFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_foreign_key :users, :admins
    remove_column :users, :created_by
  end
end
