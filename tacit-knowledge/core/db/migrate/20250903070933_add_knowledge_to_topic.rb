class AddKnowledgeToTopic < ActiveRecord::Migration[8.0]
  def change
    add_column :topics, :knowledge, :json, comment: "知識"
    add_column :topics, :summary, :text, comment: "概要"
  end
end
