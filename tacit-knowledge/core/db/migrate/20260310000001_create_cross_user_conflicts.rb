class CreateCrossUserConflicts < ActiveRecord::Migration[8.0]
  def change
    create_table :cross_user_conflicts, id: :string, limit: 26 do |t|
      t.string :topic_id, null: false
      t.string :request_a_id, null: false
      t.string :request_b_id, null: false
      t.text :question_a, null: false
      t.text :answer_a, null: false
      t.text :question_b, null: false
      t.text :answer_b, null: false
      t.float :similarity, null: false
      t.string :status, null: false, default: 'pending'
      t.text :resolution_note
      t.string :resolved_by_type
      t.string :resolved_by_id
      t.timestamps
    end

    add_index :cross_user_conflicts, :topic_id
    add_index :cross_user_conflicts, :request_a_id
    add_index :cross_user_conflicts, :request_b_id
    add_index :cross_user_conflicts, :status
    add_index :cross_user_conflicts, [:resolved_by_type, :resolved_by_id], name: 'index_cross_user_conflicts_on_resolved_by'
  end
end
