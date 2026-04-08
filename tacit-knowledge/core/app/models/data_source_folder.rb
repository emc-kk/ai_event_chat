class DataSourceFolder < ApplicationRecord
  include Permissible

  # Associations
  belongs_to :company
  belongs_to :created_by, polymorphic: true
  belongs_to :parent, class_name: "DataSourceFolder", optional: true
  has_many :children, class_name: "DataSourceFolder", foreign_key: :parent_id, dependent: :destroy
  has_many :data_source_files, foreign_key: :folder_id, dependent: :nullify

  # Soft delete
  acts_as_paranoid

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :name, uniqueness: { scope: [:company_id, :parent_id, :deleted_at], message: "同じフォルダ内に同名のフォルダが存在します" }
  validate :prevent_circular_reference, if: -> { parent_id_changed? }

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

  def files_count
    data_source_files.count
  end

  private

  def permission_parent
    parent
  end

  # 循環参照防止: 自分自身や子孫を親に設定できない
  def prevent_circular_reference
    return if parent_id.nil?

    if parent_id == id
      errors.add(:parent_id, "自分自身を親フォルダに設定できません")
      return
    end

    # 子孫を辿って循環参照をチェック
    ancestor_id = parent_id
    seen = Set.new([id])
    while ancestor_id
      if seen.include?(ancestor_id)
        errors.add(:parent_id, "循環参照が発生するため、この移動先は無効です")
        return
      end
      seen.add(ancestor_id)
      ancestor_id = self.class.where(id: ancestor_id).pick(:parent_id)
    end
  end
end
