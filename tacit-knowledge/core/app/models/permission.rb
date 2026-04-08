class Permission < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :permissible, polymorphic: true
  belongs_to :grantee, polymorphic: true, optional: true
  belongs_to :granted_by, class_name: "Admin", optional: true

  # Soft delete
  acts_as_paranoid

  # Enums
  enum :role, { viewer: 0, editor: 1, owner: 2 }, prefix: true

  # Validations
  validates :role, presence: true
  validates :grantee_type, presence: true, inclusion: { in: %w[Admin User UserGroup], message: "は Admin, User, UserGroup のみ指定可能です" }
  validates :grantee_id, presence: true
  validates :grantee_id, uniqueness: {
    scope: [:permissible_type, :permissible_id, :grantee_type, :deleted_at],
    message: "この対象には既に権限が設定されています"
  }
  validate :grantee_belongs_to_same_company

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :for_permissible, ->(permissible) {
    where(permissible_type: permissible.class.name, permissible_id: permissible.id)
  }
  scope :for_grantee, ->(grantee) {
    where(grantee_type: grantee.class.name, grantee_id: grantee.id)
  }
  scope :viewers_and_above, -> { where(role: [:viewer, :editor, :owner]) }
  scope :editors_and_above, -> { where(role: [:editor, :owner]) }
  scope :owners_only, -> { where(role: :owner) }

  private

  # grantee が同じ会社に所属していることを検証
  def grantee_belongs_to_same_company
    return if company_id.blank? || grantee_type.blank? || grantee_id.blank?
    return unless %w[Admin User UserGroup].include?(grantee_type)

    grantee_record = grantee_type.constantize.find_by(id: grantee_id)
    return errors.add(:grantee_id, "が見つかりません") unless grantee_record

    # 特権管理者 (company_id=nil) はどの会社のリソースにも権限を持てる
    return if grantee_record.company_id.nil?

    unless grantee_record.company_id == company_id
      errors.add(:grantee_id, "は同じ会社に所属している必要があります")
    end
  end
end
