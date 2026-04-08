# データソース関連コントローラの権限チェック共通Concern
#
# 使い方:
#   class Api::DataSourceFoldersController < ApplicationController
#     include DataSourceAccessControl
#     before_action :require_ds_editor, only: [:create, :update, :destroy]
#   end
#
# リソース解決順序:
#   @file → @folder → params[:folder_id] / params[:parent_id]
#
module DataSourceAccessControl
  extend ActiveSupport::Concern

  private

  # viewer以上の権限を要求（閲覧系: index, download, search）
  def require_ds_viewer
    return if current_admin? || current_user_company_admin?

    resource = resolve_ds_resource
    return if resource&.viewable_by?(current_user, session[:user_type])

    deny_ds_access
  end

  # editor以上の権限を要求（作成・編集・削除系）
  def require_ds_editor
    return if current_admin? || current_user_company_admin?

    resource = resolve_ds_resource
    return if resource&.editable_by?(current_user, session[:user_type])

    deny_ds_access
  end

  # owner権限を要求（権限管理系）
  def require_ds_owner
    return if current_admin? || current_user_company_admin?

    resource = resolve_ds_resource
    return if resource&.owned_by?(current_user, session[:user_type])

    deny_ds_access
  end

  # リソース解決: @file → @folder → params から DataSourceFolder を探す
  def resolve_ds_resource
    return @file if defined?(@file) && @file.present?
    return @folder if defined?(@folder) && @folder.present?

    folder_id = params[:folder_id] || params[:parent_id]
    if folder_id.present?
      scope = privileged_admin? ? DataSourceFolder.all : DataSourceFolder.for_company(current_company_id)
      scope.find_by(id: folder_id)
    else
      nil # ルートレベル: Admin/CompanyAdminは上位で許可済み、Userはdeny_ds_accessへ
    end
  end

  def deny_ds_access
    if request.path.start_with?("/api/")
      render json: { error: "権限がありません" }, status: :forbidden
    else
      respond_to do |format|
        format.html { redirect_to data_sources_path, alert: "この操作を行う権限がありません" }
        format.json { render json: { error: "権限がありません" }, status: :forbidden }
      end
    end
  end
end
