class RenameRoomTypeToChatTypeInRooms < ActiveRecord::Migration[8.0]
  def up
    remove_index :rooms, name: 'index_rooms_on_request_id_and_room_type', if_exists: true
    rename_column :rooms, :room_type, :chat_type
    add_index :rooms, [:request_id, :chat_type], name: 'index_rooms_on_request_id_and_chat_type'
  end

  def down
    remove_index :rooms, name: 'index_rooms_on_request_id_and_chat_type', if_exists: true
    rename_column :rooms, :chat_type, :room_type
    add_index :rooms, [:request_id, :room_type], name: 'index_rooms_on_request_id_and_room_type'
  end
end
