# frozen_string_literal: true

class Chapter < ApplicationRecord
  belongs_to :manual
  belongs_to :request_document, optional: true
end
