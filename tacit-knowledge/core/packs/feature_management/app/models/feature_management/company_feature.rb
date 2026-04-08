module FeatureManagement
  class CompanyFeature < ApplicationRecord
    belongs_to :company
    belongs_to :feature, class_name: "FeatureManagement::Feature"

    validates :company_id, uniqueness: { scope: :feature_id }

    scope :for_company, ->(company_id) { where(company_id: company_id) }
    scope :enabled, -> { where(enabled: true) }
  end
end
