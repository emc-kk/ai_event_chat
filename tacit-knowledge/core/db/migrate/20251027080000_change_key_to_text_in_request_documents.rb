class ChangeKeyToTextInRequestDocuments < ActiveRecord::Migration[8.0]
  def change
    change_column :request_documents, :key, :text
  end
end

