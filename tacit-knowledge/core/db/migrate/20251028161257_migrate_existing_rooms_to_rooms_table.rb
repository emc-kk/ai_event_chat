class MigrateExistingRoomsToRoomsTable < ActiveRecord::Migration[8.0]
  def up
    # 既存のroom_idをhearingタイプのroomとして移行
    Request.where.not(room_id: nil).find_each do |request|
      Room.create!(
        id: request.room_id,
        request_id: request.id,
        request_content_id: request.request_contents.first&.id,
        room_type: 'hearing',
        is_finished: false,
        is_deleted: false,
        created_at: request.created_at,
        updated_at: request.updated_at
      )
    end
    
    # 既存のvalidation_room_idをvalidationタイプのroomとして移行
    Request.where.not(validation_room_id: nil).find_each do |request|
      Room.create!(
        id: request.validation_room_id,
        request_id: request.id,
        request_content_id: request.request_contents.first&.id,
        room_type: 'validation',
        is_finished: false,
        is_deleted: false,
        created_at: request.created_at,
        updated_at: request.updated_at
      )
    end
  end

  def down
    # 移行を元に戻す
    Room.where(room_type: 'hearing').find_each do |room|
      request = Request.find(room.request_id)
      request.update!(room_id: room.id)
    end
    
    Room.where(room_type: 'validation').find_each do |room|
      request = Request.find(room.request_id)
      request.update!(validation_room_id: room.id)
    end
    
    Room.delete_all
  end
end
