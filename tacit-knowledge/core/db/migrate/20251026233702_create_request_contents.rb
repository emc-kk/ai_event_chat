class CreateRequestContents < ActiveRecord::Migration[8.0]
  def change
    create_table :request_contents, id: :string, limit: 26 do |t|
      t.string :request_id, null: false, comment: "リクエストID"
      t.string :name, comment: "名前"
      t.text :context, comment: "コンテキスト"

      t.timestamps
    end

    add_index :request_contents, :request_id
  end
end
