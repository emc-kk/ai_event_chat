class RenameMessageIdToQuestionIdInMessages < ActiveRecord::Migration[8.0]
  def change
    rename_column :messages, :message_id, :question_id
    add_index :messages, :question_id unless index_exists?(:messages, :question_id)
  end
end
