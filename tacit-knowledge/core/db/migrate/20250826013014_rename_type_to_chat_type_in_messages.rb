class RenameTypeToChatTypeInMessages < ActiveRecord::Migration[8.0]
  def change
    rename_column :messages, :type, :chat_type
  end
end
