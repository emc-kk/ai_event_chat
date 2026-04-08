class RequestContent < ApplicationRecord
  # Associations
  belongs_to :request
  has_many :rooms, dependent: :destroy
end

