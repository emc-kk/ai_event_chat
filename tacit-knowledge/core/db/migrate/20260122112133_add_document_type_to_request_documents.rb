class AddDocumentTypeToRequestDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :request_documents, :file_type, :string
  end
end
