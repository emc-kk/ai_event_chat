class CreateRooms < ActiveRecord::Migration[8.0]
  def change
    create_table :rooms, id: :string, limit: 26 do |t|
      t.string :request_id, null: false, comment: "リクエストID"
      t.string :request_content_id, comment: "リクエストコンテンツID"
      t.string :room_type, null: false, comment: "ルームタイプ（hearing/validation）"
      t.boolean :is_finished, default: false, null: false, comment: "完了フラグ"
      t.boolean :is_deleted, default: false, null: false, comment: "削除フラグ"

      t.timestamps
      
      t.index [:request_id, :room_type], name: "index_rooms_on_request_id_and_room_type"
      t.index :request_content_id, name: "index_rooms_on_request_content_id"
      t.index :is_finished, name: "index_rooms_on_is_finished"
      t.index :is_deleted, name: "index_rooms_on_is_deleted"
    end
    
    add_foreign_key :rooms, :requests, column: :request_id
    add_foreign_key :rooms, :request_contents, column: :request_content_id
  end
end
