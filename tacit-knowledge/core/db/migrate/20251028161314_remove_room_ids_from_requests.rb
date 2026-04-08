class RemoveRoomIdsFromRequests < ActiveRecord::Migration[8.0]
  def change
    remove_index :requests, :room_id, if_exists: true
    remove_index :requests, :validation_room_id, if_exists: true
    remove_column :requests, :room_id, :string, if_exists: true
    remove_column :requests, :validation_room_id, :string, if_exists: true
  end
end
