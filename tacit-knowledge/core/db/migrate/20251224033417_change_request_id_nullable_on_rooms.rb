class ChangeRequestIdNullableOnRooms < ActiveRecord::Migration[8.0]
  def change
    change_column_null :rooms, :request_id, true
  end
end
