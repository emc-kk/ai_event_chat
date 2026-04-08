class AddCommentToRequestContents < ActiveRecord::Migration[8.0]
  def change
    add_column :request_contents, :comment, :text, comment: "コメント"
  end
end

