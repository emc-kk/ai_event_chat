class AddVideoIdToManualsAndRequestDocumentIdToChaptersAndTranscriptions < ActiveRecord::Migration[8.0]
  def change
    add_reference :manuals, :video, type: :string, limit: 26, foreign_key: { to_table: :request_documents }, comment: '動画ドキュメントID'
    add_reference :chapters, :request_document, type: :string, limit: 26, foreign_key: true, comment: '動画ドキュメントID'
    add_reference :transcriptions, :request_document, type: :string, limit: 26, foreign_key: true, comment: '動画ドキュメントID'
  end
end
