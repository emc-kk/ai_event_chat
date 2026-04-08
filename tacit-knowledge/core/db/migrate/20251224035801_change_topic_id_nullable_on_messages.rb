class ChangeTopicIdNullableOnMessages < ActiveRecord::Migration[8.0]
  def change
    change_column_null :messages, :topic_id, true
  end
end
