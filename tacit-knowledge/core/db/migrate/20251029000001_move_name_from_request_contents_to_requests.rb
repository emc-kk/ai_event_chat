class MoveNameFromRequestContentsToRequests < ActiveRecord::Migration[8.0]
  def change
    # requestsテーブルにname, descriptionカラムを追加
    add_column :requests, :name, :string, comment: "リクエスト名"
    add_column :requests, :description, :text, comment: "説明"
    
    # request_contentsテーブルからnameカラムを削除
    remove_column :request_contents, :name, :string, comment: "名前"
  end
end

