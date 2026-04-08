class AddIconColorColumnToTopics < ActiveRecord::Migration[8.0]
  def change
    add_column :topics, :icon_color, :integer, comment: 'アイコンの色指定'
  end
end
