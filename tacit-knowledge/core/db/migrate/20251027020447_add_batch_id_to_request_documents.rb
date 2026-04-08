class AddBatchIdToRequestDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :request_documents, :batch_id, :string
  end
end
