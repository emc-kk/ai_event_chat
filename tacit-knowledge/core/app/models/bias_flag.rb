class BiasFlag < ApplicationRecord
  belongs_to :request
  belongs_to :source_message, class_name: 'Message', optional: true

  BIAS_TYPES = %w[
    optimistic_assertion
    confirmation_bias
    sunk_cost
    authority_bias
    overconfidence
  ].freeze

  validates :bias_type, inclusion: { in: BIAS_TYPES }
  validates :detection_stage, inclusion: { in: %w[pattern_match llm_contextual] }
  validates :status, inclusion: { in: %w[pending injected dismissed] }
  validates :confidence_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 1 }, allow_nil: true

  scope :pending, -> { where(status: 'pending') }
  scope :for_request, ->(request_id) { where(request_id: request_id) }
end
