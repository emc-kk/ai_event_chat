class AddEmailToQuizResults < ActiveRecord::Migration[7.1]
  def change
    add_column :quiz_results, :email, :string, null: true
    
    add_index :quiz_results, :email
  end
end