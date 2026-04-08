class UserGroup < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :created_by, polymorphic: true
  has_many :user_group_memberships, dependent: :destroy
  has_many :users, through: :user_group_memberships
  has_many :permissions, as: :grantee, dependent: :destroy

  # Soft delete
  acts_as_paranoid

  # Validations
  validates :name, presence: true, length: { maximum: 100 }
  validates :name, uniqueness: {
    scope: [:company_id, :deleted_at],
    message: "同じ会社内に同名のグループが存在します"
  }

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }

  def members_count
    user_group_memberships.count
  end
end
