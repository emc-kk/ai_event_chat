class ChangeRoomIdToNullable < ActiveRecord::Migration[8.0]
  def change
    change_column_null :requests, :room_id, true
    change_column_null :requests, :validation_room_id, true
  end
end
