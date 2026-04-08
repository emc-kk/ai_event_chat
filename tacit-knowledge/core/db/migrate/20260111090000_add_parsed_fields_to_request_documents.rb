class AddParsedFieldsToRequestDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :request_documents, :parsed_document_key, :text, comment: "パース済みドキュメントのS3キー"
    add_column :request_documents, :token_count, :integer, comment: "トークン数"
  end
end
