class AddScoreToQuizResults < ActiveRecord::Migration[7.1]
  def change
    add_column :quiz_results, :score, :bigint
    add_index :quiz_results, [:quiz, :score], order: { score: :desc }
  end
end
