class CrossUserConflict < ApplicationRecord
  belongs_to :topic
  belongs_to :request_a, class_name: 'Request'
  belongs_to :request_b, class_name: 'Request'
  belongs_to :resolved_by, polymorphic: true, optional: true

  scope :pending, -> { where(status: 'pending') }
  scope :resolved, -> { where.not(status: 'pending') }
  scope :for_topic, ->(topic_id) { where(topic_id: topic_id) }
  scope :involving_request, ->(request_id) { where('request_a_id = ? OR request_b_id = ?', request_id, request_id) }

  validates :status, inclusion: { in: %w[pending resolved_a resolved_b dismissed] }
end
