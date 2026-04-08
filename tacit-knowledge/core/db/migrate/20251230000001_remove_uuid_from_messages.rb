class RemoveUuidFromMessages < ActiveRecord::Migration[8.0]
  def change
    remove_index :messages, :uuid, if_exists: true
    remove_column :messages, :uuid, :string
  end
end
