# frozen_string_literal: true

class ComparisonElement < ApplicationRecord
  belongs_to :comparison_session

  validates :classification, presence: true
  validates :knowledge_element, presence: true

  enum :classification, { consensus: 0, divergence: 1, gap: 2 }
  enum :resolution, { adopted: 0, merged_condition: 1, flagged: 2 }, allow_nil: true
end
