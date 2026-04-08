class HearingSuggestion < ApplicationRecord
  belongs_to :request

  scope :pending, -> { where(is_answered: false) }
  scope :answered, -> { where(is_answered: true) }
end
