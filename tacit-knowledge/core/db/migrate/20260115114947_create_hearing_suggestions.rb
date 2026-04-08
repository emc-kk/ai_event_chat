class CreateHearingSuggestions < ActiveRecord::Migration[8.0]
  def change
    create_table :hearing_suggestions, id: { type: :string, limit: 26 } do |t|
      t.string :request_id, limit: 26, null: false
      t.text :question, null: false
      t.jsonb :answer_candidates, default: []
      t.string :category
      t.boolean :is_answered, default: false
      t.timestamps
    end

    add_index :hearing_suggestions, :request_id
    add_index :hearing_suggestions, [:request_id, :is_answered]
    add_foreign_key :hearing_suggestions, :requests, on_delete: :cascade
  end
end
