class UserGroupMembership < ApplicationRecord
  # Associations
  belongs_to :user_group
  belongs_to :user

  # Soft delete
  acts_as_paranoid

  # Validations
  validates :user_id, uniqueness: {
    scope: [:user_group_id, :deleted_at],
    message: "は既にこのグループに所属しています"
  }
  validate :user_belongs_to_same_company

  private

  def user_belongs_to_same_company
    return if user_group.blank? || user.blank?

    unless user.company_id == user_group.company_id
      errors.add(:user_id, "は同じ会社に所属している必要があります")
    end
  end
end
