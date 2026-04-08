class AddMessageIdToMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :messages, :message_id, :string, comment: "関連するsystemメッセージのID（userメッセージの場合）"
    add_index :messages, :message_id
  end
end
