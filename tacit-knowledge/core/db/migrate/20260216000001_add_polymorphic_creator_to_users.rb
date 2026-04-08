class AddPolymorphicCreatorToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :creator_type, :string, comment: "作成者の型（Admin or User）"
    add_column :users, :creator_id, :string, limit: 26, comment: "作成者のID"

    add_index :users, [:creator_type, :creator_id]
  end
end
