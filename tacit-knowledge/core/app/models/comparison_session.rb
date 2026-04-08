# frozen_string_literal: true

class ComparisonSession < ApplicationRecord
  belongs_to :topic
  belongs_to :merged_topic, class_name: "Topic", optional: true
  belongs_to :created_by, polymorphic: true
  has_many :comparison_elements, dependent: :destroy

  validates :request_ids, presence: true

  enum :status, { analyzing: 0, in_review: 1, completed: 2 }, prefix: true

  def requests
    Request.where(id: request_ids)
  end

  def all_resolved?
    comparison_elements.where(classification: [:divergence, :gap]).all? { |e| e.resolution.present? || e.resolution_comment.present? }
  end
end
