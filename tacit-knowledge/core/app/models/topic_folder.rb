class TopicFolder < ApplicationRecord
  include Permissible

  # Associations
  belongs_to :company
  belongs_to :created_by, polymorphic: true
  belongs_to :parent, class_name: "TopicFolder", optional: true
  has_many :children, class_name: "TopicFolder", foreign_key: :parent_id, dependent: :destroy
  has_many :topics, foreign_key: :folder_id, dependent: :nullify

  # Soft delete
  acts_as_paranoid

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :name, uniqueness: { scope: [:company_id, :parent_id, :deleted_at], message: "同じフォルダ内に同名のフォルダが存在します" }

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :roots, -> { where(parent_id: nil) }

  def breadcrumb
    ancestors = []
    current = self
    while current
      ancestors.unshift(current)
      current = current.parent
    end
    ancestors
  end

  def topics_count
    topics.count
  end

  def breadcrumb_path
    breadcrumb.map(&:name).join(" / ")
  end

  private

  def permission_parent
    parent
  end
end
