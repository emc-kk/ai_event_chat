class RemoveDescriptionFromRequests < ActiveRecord::Migration[8.0]
  def change
    remove_column :requests, :description, :string
  end
end
