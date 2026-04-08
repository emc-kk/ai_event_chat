class RequestDocument < ApplicationRecord
  # Associations
  belongs_to :request
  has_many :transcriptions, dependent: :nullify
  has_many :chapters, dependent: :nullify

  # Validations
  validates :key, presence: true

  # Enums
  enum :status, { pending: 0, processing: 1, completed: 2, failed: 3 }, default: :pending
end
