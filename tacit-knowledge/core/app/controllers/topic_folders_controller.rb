class TopicFoldersController < ApplicationController
  include FolderOperations

  before_action :set_folder, only: [:update, :destroy, :move]
  before_action :require_editor_permission, only: [:create, :update, :destroy, :move]

  # POST /topic_folders
  def create
    folder = TopicFolder.new(folder_params)
    folder.company_id = privileged_admin? ? params[:topic_folder][:company_id] : current_company_id
    folder.created_by = current_user

    if folder.save
      redirect_to topics_path(folder_id: folder.parent_id), notice: "フォルダを作成しました"
    else
      redirect_to topics_path(folder_id: folder.parent_id), alert: folder.errors.full_messages.join(", ")
    end
  end

  # PATCH /topic_folders/:id
  def update
    if @folder.update(name: params[:topic_folder][:name])
      redirect_to topics_path(folder_id: @folder.parent_id), notice: "フォルダ名を更新しました"
    else
      redirect_to topics_path(folder_id: @folder.parent_id), alert: @folder.errors.full_messages.join(", ")
    end
  end

  # DELETE /topic_folders/:id
  def destroy
    parent_id = @folder.parent_id
    @folder.destroy
    redirect_to topics_path(folder_id: parent_id), notice: "フォルダを削除しました"
  end

  # PATCH /topic_folders/:id/move
  def move
    new_parent_id = params[:parent_id]
    error = validate_folder_move(@folder, new_parent_id, folder_scope)

    if error
      redirect_to topics_path(folder_id: @folder.parent_id), alert: error
      return
    end

    @folder.update!(parent_id: new_parent_id)
    redirect_to topics_path(folder_id: new_parent_id), notice: "フォルダを移動しました"
  end

  private

  def set_folder
    @folder = folder_scope.find(params[:id])
  end

  def folder_scope
    privileged_admin? ? TopicFolder.all : TopicFolder.for_company(current_company_id)
  end

  def folder_params
    permitted = [:name, :parent_id]
    permitted << :company_id if privileged_admin?
    params.require(:topic_folder).permit(*permitted).tap do |p|
      p.delete(:parent_id) if p[:parent_id].blank?
    end
  end

  # Admin / Company Admin は常に許可、User は対象フォルダ(または親フォルダ)に editor 以上の権限があれば許可
  def require_editor_permission
    return if admin_or_company_admin?

    # 作成時: 親フォルダの権限をチェック（ルートの場合は権限なしでAdmin以外不可）
    if action_name == "create"
      parent_id = params.dig(:topic_folder, :parent_id) || params[:parent_id]
      if parent_id.present?
        parent_folder = folder_scope.find_by(id: parent_id)
        return if parent_folder&.editable_by?(current_user, session[:user_type])
      end
    else
      # 更新・削除・移動: 対象フォルダの権限をチェック
      return if @folder&.editable_by?(current_user, session[:user_type])
    end

    redirect_to topics_path, alert: "この操作を行う権限がありません"
  end
end
