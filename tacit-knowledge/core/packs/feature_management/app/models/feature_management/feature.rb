module FeatureManagement
  class Feature < ApplicationRecord
    belongs_to :parent, class_name: "FeatureManagement::Feature", optional: true
    has_many :children, class_name: "FeatureManagement::Feature", foreign_key: :parent_id, dependent: :destroy
    has_many :company_features, class_name: "FeatureManagement::CompanyFeature", dependent: :destroy

    enum :feature_type, { bc: 0, screen: 1, background: 2 }, prefix: true

    validates :name, presence: true, uniqueness: true
    validates :feature_type, presence: true
    validate :max_depth_two

    scope :roots, -> { where(parent_id: nil) }
    scope :by_name, ->(name) { find_by!(name: name) }

    private

    def max_depth_two
      if parent.present? && parent.parent_id.present?
        errors.add(:parent_id, "ツリー深さは2階層まで")
      end
    end
  end
end
