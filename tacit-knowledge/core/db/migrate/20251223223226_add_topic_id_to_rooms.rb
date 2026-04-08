class AddTopicIdToRooms < ActiveRecord::Migration[8.0]
  def change
    add_column :rooms, :topic_id, :string, limit: 26, comment: 'トピックID'
    add_index :rooms, :topic_id
    add_foreign_key :rooms, :topics, column: :topic_id, on_delete: :cascade
  end
end
