class TopicDataSourceLink < ApplicationRecord
  # Associations
  belongs_to :topic
  belongs_to :data_source_file
  belongs_to :linked_by, polymorphic: true

  # Validations
  validates :data_source_file_id, uniqueness: {
    scope: :topic_id,
    message: "このファイルは既にこのトピックにリンクされています"
  }
  validate :file_must_be_completed

  # Scopes
  scope :for_topic, ->(topic_id) { where(topic_id: topic_id) }
  scope :for_file, ->(file_id) { where(data_source_file_id: file_id) }

  private

  def file_must_be_completed
    return if data_source_file&.completed?
    errors.add(:data_source_file, "AI処理が完了したファイルのみリンク可能です")
  end
end
