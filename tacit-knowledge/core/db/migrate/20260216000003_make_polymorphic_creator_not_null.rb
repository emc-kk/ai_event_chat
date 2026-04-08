class MakePolymorphicCreatorNotNull < ActiveRecord::Migration[8.0]
  def change
    change_column_null :users, :creator_type, false
    change_column_null :users, :creator_id, false
  end
end
