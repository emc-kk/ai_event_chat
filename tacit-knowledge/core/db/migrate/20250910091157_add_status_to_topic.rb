class AddStatusToTopic < ActiveRecord::Migration[8.0]
  def change
    add_column :topics, :status, :integer, default: 0, comment: "ステータス"
  end
end
