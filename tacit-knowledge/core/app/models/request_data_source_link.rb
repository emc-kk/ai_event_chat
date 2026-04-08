class RequestDataSourceLink < ApplicationRecord
  # Associations
  belongs_to :request
  belongs_to :data_source_file
  belongs_to :linked_by, polymorphic: true

  # Validations
  validates :data_source_file_id, uniqueness: {
    scope: :request_id,
    message: "このファイルは既にこのリクエストにリンクされています"
  }
  validate :file_must_be_completed

  # Scopes
  scope :for_request, ->(request_id) { where(request_id: request_id) }
  scope :for_file, ->(file_id) { where(data_source_file_id: file_id) }

  private

  def file_must_be_completed
    return if data_source_file&.completed?
    errors.add(:data_source_file, "AI処理が完了したファイルのみリンク可能です")
  end
end
