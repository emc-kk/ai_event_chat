class RemoveUserIdFromMessages < ActiveRecord::Migration[8.0]
  def change
    remove_column :messages, :user_id, :string
  end
end
