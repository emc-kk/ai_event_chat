# frozen_string_literal: true

class Manual < ApplicationRecord
  belongs_to :topic
  belongs_to :request
  belongs_to :video, class_name: 'RequestDocument', optional: true
  belongs_to :manual_template, optional: true
  has_many :transcriptions, dependent: :destroy
  has_many :chapters, dependent: :destroy
end
