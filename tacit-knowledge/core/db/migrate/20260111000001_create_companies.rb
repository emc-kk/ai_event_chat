class CreateCompanies < ActiveRecord::Migration[8.0]
  def change
    create_table :companies, id: false do |t|
      t.string :id, limit: 26, primary_key: true
      t.string :name, null: false
      t.text :description
      t.integer :status, default: 0, null: false
      t.timestamps
    end

    add_index :companies, :name
  end
end
