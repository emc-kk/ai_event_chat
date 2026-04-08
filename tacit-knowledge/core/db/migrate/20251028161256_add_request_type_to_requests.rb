class AddRequestTypeToRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :requests, :request_type, :integer, default: 0, null: false, comment: "リクエストタイプ（0:ヒアリング, 1:手動）"
    add_index :requests, :request_type
  end
end
