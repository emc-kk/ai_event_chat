# リソースの権限チェック共通Concern
#
# 使い方:
#   class TopicFolder < ApplicationRecord
#     include Permissible
#     private
#     def permission_parent
#       parent  # 権限の継承元を返す
#     end
#   end
#
# 対応モデル: TopicFolder, Topic, DataSourceFolder, DataSourceFile
#
# 権限の優先順位:
#   1. 特権管理者（company_id=nil）は常にフルアクセス
#   2. 対象に直接設定された権限をチェック（個人 → グループ）
#   3. permission_parent を辿って継承権限をチェック（個人 → グループ）
#   4. 権限設定がない場合はAdminのみアクセス可（Userはアクセス不可）
#
module Permissible
  extend ActiveSupport::Concern

  included do
    has_many :permissions, as: :permissible, dependent: :destroy
  end

  # この対象に対して閲覧権限があるか
  def viewable_by?(user, user_type)
    check_permission(user, user_type, :viewer)
  end

  # この対象に対して編集権限があるか
  def editable_by?(user, user_type)
    check_permission(user, user_type, :editor)
  end

  # この対象に対してオーナー権限があるか
  def owned_by?(user, user_type)
    check_permission(user, user_type, :owner)
  end

  # 有効な権限を取得（直接 + 継承）
  def effective_permissions
    direct = permissions.to_a
    inherited = inherited_permissions
    direct + inherited
  end

  # この対象に直接設定された権限があるか
  def has_direct_permissions?
    permissions.exists?
  end

  # 継承された権限一覧
  def inherited_permissions
    perms = []
    current = permission_parent
    while current
      perms.concat(current.permissions.to_a)
      current = current.respond_to?(:permission_parent, true) ? current.send(:permission_parent) : nil
    end
    perms
  end

  private

  def check_permission(user, user_type, minimum_role)
    return false if user.nil?

    # 特権管理者は常にフルアクセス
    return true if user_type == "admin" && user.company_id.nil?

    # 直接権限チェック（個人）
    direct = find_permission_for(user, user_type)
    return role_sufficient?(direct.role, minimum_role) if direct

    # 直接権限チェック（グループ）
    group_perm = find_group_permission_for(user)
    return role_sufficient?(group_perm.role, minimum_role) if group_perm

    # 継承権限チェック（個人 + グループ）
    inherited = find_inherited_permission_for(user, user_type)
    return role_sufficient?(inherited.role, minimum_role) if inherited

    # 権限設定がない場合: 同一会社のAdmin / Company Adminのみアクセス可
    if no_permissions_in_chain?
      if user_type == "admin"
        user.company_id.nil? || user.company_id == self.company_id
      elsif user.respond_to?(:role_company_admin?) && user.role_company_admin? && user.company_id == self.company_id
        true
      else
        false
      end
    else
      false
    end
  end

  def find_permission_for(user, user_type)
    grantee_type = user_type == "admin" ? "Admin" : "User"
    permissions.find_by(grantee_type: grantee_type, grantee_id: user.id)
  end

  # ユーザーが所属するグループ経由の権限を探す（最も高いロールを返す）
  def find_group_permission_for(user)
    return nil unless user.is_a?(User)

    group_ids = user.user_group_ids
    return nil if group_ids.empty?

    permissions
      .where(grantee_type: "UserGroup", grantee_id: group_ids)
      .order(role: :desc)
      .first
  end

  def find_inherited_permission_for(user, user_type)
    parent_permissible = permission_parent
    return nil unless parent_permissible

    grantee_type = user_type == "admin" ? "Admin" : "User"
    group_ids = user.is_a?(User) ? user.user_group_ids : []

    # 親を辿って権限を探す（個人 → グループの順）
    current = parent_permissible
    while current
      # 個人権限チェック
      perm = current.permissions.find_by(grantee_type: grantee_type, grantee_id: user.id)
      return perm if perm

      # グループ権限チェック
      if group_ids.present?
        group_perm = current.permissions
          .where(grantee_type: "UserGroup", grantee_id: group_ids)
          .order(role: :desc)
          .first
        return group_perm if group_perm
      end

      current = current.respond_to?(:permission_parent, true) ? current.send(:permission_parent) : nil
    end

    nil
  end

  # 権限チェーン全体で権限設定がないかを確認
  def no_permissions_in_chain?
    return false if permissions.exists?

    current = permission_parent
    while current
      return false if current.permissions.exists?
      current = current.respond_to?(:permission_parent, true) ? current.send(:permission_parent) : nil
    end

    true
  end

  # 権限の継承元（各モデルでオーバーライド）
  # TopicFolder / DataSourceFolder: parent フォルダ
  # Topic: folder
  # DataSourceFile: folder
  def permission_parent
    nil
  end

  def role_sufficient?(actual_role, minimum_role)
    role_values = { "viewer" => 0, "editor" => 1, "owner" => 2 }
    role_values[actual_role.to_s] >= role_values[minimum_role.to_s]
  end

end
