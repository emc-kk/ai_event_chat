class CreateFeatures < ActiveRecord::Migration[8.0]
  def change
    create_table :features, id: { type: :string, limit: 26 } do |t|
      t.string :name, null: false
      t.integer :feature_type, null: false
      t.string :parent_id

      t.timestamps
    end

    add_index :features, :name, unique: true
    add_index :features, :parent_id
  end
end
