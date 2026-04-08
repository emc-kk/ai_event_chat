class CreateRequestDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :request_documents, id: :string, limit: 26 do |t|
      t.string :request_id, null: false, comment: "リクエストID"
      t.string :key, comment: "キー"
      t.integer :status, default: 0, comment: "ステータス"

      t.timestamps
    end

    add_index :request_documents, :request_id
  end
end
