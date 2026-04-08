# frozen_string_literal: true

class Transcription < ApplicationRecord
  belongs_to :manual
  belongs_to :request_document, optional: true
end
