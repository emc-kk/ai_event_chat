class CreateRunkings < ActiveRecord::Migration[7.1]
  def change
    create_table :quize_results, id: :string, limit: 26 do |t|
      t.quize :integer, null: false
      t.bigint :completion_time, null: false
      t.integer :correct_count, null: false
      t.json :answers, null: false

      t.timestamps
    end

    add_index :runkings, :completion_time
    add_index :runkings, :correct_count
  end
end
