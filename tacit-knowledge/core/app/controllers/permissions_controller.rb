class PermissionsController < ApplicationController
  before_action :set_permissible
  before_action :require_owner_permission

  # GET /permissions?permissible_type=TopicFolder&permissible_id=xxx
  def index
    @permissions = @permissible.permissions.includes(:grantee)
    @inherited_permissions = @permissible.inherited_permissions
    target_company_id = @permissible.company_id
    if target_company_id.present?
      @available_admins = Admin.for_company(target_company_id).or(Admin.privileged).includes(:company)
      @available_users = User.for_company(target_company_id).includes(:company)
      @available_groups = UserGroup.for_company(target_company_id).includes(:company)
    elsif privileged_admin?
      # permissible に company_id がない場合（特権管理者作成リソース）は全社から表示
      @available_admins = Admin.includes(:company).all
      @available_users = User.includes(:company).where.not(company_id: nil)
      @available_groups = UserGroup.includes(:company).where.not(company_id: nil)
    else
      @available_admins = Admin.none
      @available_users = User.none
      @available_groups = UserGroup.none
    end
    @title = "#{@permissible.name} の権限設定"
    @back_path = return_path
    @can_edit_permissions = admin_or_company_admin? || @permissible.owned_by?(current_user, session[:user_type])
  end

  # POST /permissions
  def create
    permission = Permission.new(permission_params)
    permission.permissible = @permissible
    # company_id: permissible から取得、なければフォームの company_id、それもなければ grantee から推定
    permission.company_id = @permissible.company_id ||
                            params.dig(:permission, :company_id).presence ||
                            resolve_company_from_grantee(permission)
    # granted_by_id: Admin型の場合のみセット（外部キー制約がadminsテーブルを参照するため、User型はnil）
    permission.granted_by_id = current_admin? ? current_user.id : nil

    # 非Admin/非Company Adminユーザーは grantee_type=Admin を指定できない
    if !admin_or_company_admin? && permission.grantee_type == "Admin"
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  alert: "管理者への権限付与はAdmin権限が必要です"
      return
    end

    # grantee の会社と permission の会社が一致するか検証（他社ユーザーへの権限付与を防止）
    if permission.company_id.present? && permission.grantee_type.in?(%w[User UserGroup])
      grantee = permission.grantee_type.constantize.find_by(id: permission.grantee_id)
      if grantee && grantee.company_id != permission.company_id
        redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                    alert: "異なる会社のユーザー/グループには権限を付与できません"
        return
      end
    end

    if permission.save
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  notice: "権限を追加しました"
    else
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  alert: permission.errors.full_messages.join(", ")
    end
  end

  # PATCH /permissions/:id
  def update
    @permission = @permissible.permissions.find(params[:id])
    new_role = params.dig(:permission, :role) || params[:role]

    unless Permission.roles.key?(new_role)
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  alert: "不正なロールです"
      return
    end

    if @permission.update(role: new_role)
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  notice: "権限を更新しました"
    else
      redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                  alert: @permission.errors.full_messages.join(", ")
    end
  end

  # DELETE /permissions/:id
  def destroy
    @permission = @permissible.permissions.find(params[:id])
    @permission.destroy
    redirect_to permissions_path(permissible_type: @permissible.class.name, permissible_id: @permissible.id),
                notice: "権限を削除しました"
  end

  private

  def set_permissible
    case params[:permissible_type]
    when "TopicFolder"
      @permissible = scoped_find(TopicFolder, params[:permissible_id])
    when "Topic"
      @permissible = scoped_find(Topic, params[:permissible_id])
    when "DataSourceFolder"
      @permissible = scoped_find(DataSourceFolder, params[:permissible_id])
    when "DataSourceFile"
      @permissible = scoped_find(DataSourceFile, params[:permissible_id])
    else
      redirect_to topics_path, alert: "不正な対象です"
    end
  end

  def scoped_find(klass, id)
    privileged_admin? ? klass.find(id) : klass.for_company(current_company_id).find(id)
  end

  def permission_scope
    Permission.for_company(current_company_id)
  end

  ALLOWED_GRANTEE_TYPES = %w[Admin User UserGroup].freeze

  def permission_params
    permit_list = [:grantee_type, :grantee_id, :role]
    permit_list << :company_id if privileged_admin?
    permitted = params.require(:permission).permit(*permit_list)
    # 不正なgrantee_typeをサーバー側で除去
    unless ALLOWED_GRANTEE_TYPES.include?(permitted[:grantee_type])
      permitted[:grantee_type] = nil
    end
    permitted
  end

  # permissible に company_id がない場合、grantee の company_id を使用
  def resolve_company_from_grantee(permission)
    return nil unless permission.grantee_type.present? && permission.grantee_id.present?
    return nil unless %w[Admin User UserGroup].include?(permission.grantee_type)

    grantee = permission.grantee_type.constantize.find_by(id: permission.grantee_id)
    grantee&.company_id
  end

  def return_path
    case @permissible
    when TopicFolder
      topics_path(folder_id: @permissible.parent_id)
    when Topic
      topics_path(folder_id: @permissible.folder_id)
    when DataSourceFolder
      data_sources_path(parent_id: @permissible.parent_id)
    when DataSourceFile
      data_sources_path(parent_id: @permissible.folder_id)
    else
      root_path
    end
  end

  # Admin / Company Admin は常に許可、User は対象に owner 権限があれば許可
  def require_owner_permission
    return if admin_or_company_admin?
    return if @permissible&.owned_by?(current_user, session[:user_type])

    fallback = @permissible.is_a?(DataSourceFolder) || @permissible.is_a?(DataSourceFile) ? data_sources_path : topics_path
    redirect_to fallback, alert: "この操作を行う権限がありません"
  end
end
