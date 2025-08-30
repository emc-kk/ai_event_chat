class CreateQuizResults < ActiveRecord::Migration[7.1]
  def change
    create_table :quiz_results, id: :string, limit: 26 do |t|
      t.integer :quiz, null: false
      t.bigint :completion_time, null: false
      t.integer :correct_count, null: false
      t.json :answers, null: false

      t.timestamps
    end

    add_index :quiz_results, :quiz
    add_index :quiz_results, :completion_time
    add_index :quiz_results, :correct_count
  end
end
