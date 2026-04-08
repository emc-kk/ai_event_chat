class RemoveKnowledgeFromTopics < ActiveRecord::Migration[8.0]
  def change
    remove_column :topics, :knowledge, :json
  end
end
