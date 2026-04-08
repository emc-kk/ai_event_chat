# frozen_string_literal: true

class ManualTemplate < ApplicationRecord
  belongs_to :company, optional: true
  belongs_to :created_by, polymorphic: true, optional: true
  has_many :manuals, dependent: :nullify

  validates :name, presence: true
  validates :sections, presence: true

  enum :output_format, { markdown: 0, docx: 1 }, prefix: true

  scope :presets, -> { where(is_preset: true) }
  scope :universal_presets, -> { where(is_preset: true, category: nil) }
  scope :for_company, ->(company_id) { where(company_id: company_id).or(where(is_preset: true, category: nil)) }
end
