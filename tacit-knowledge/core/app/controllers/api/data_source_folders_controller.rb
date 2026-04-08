module Api
  class DataSourceFoldersController < ApplicationController
    include RequireCompanyContext
    include FolderOperations
    include DataSourceAccessControl

    skip_before_action :verify_authenticity_token
    before_action :require_company_context
    before_action :set_folder, only: [:update, :destroy, :move]
    before_action :require_ds_editor, only: [:create, :update, :destroy, :move]

    # GET /api/data_source_folders?parent_id=xxx
    def index
      # Admin/CompanyAdminは全表示、Userは権限のあるフォルダ/ファイルのみ
      if full_ds_access?
        folders = folder_scope
        files = file_scope
      else
        folders = visible_ds_folders
        files = visible_ds_files
      end

      if full_ds_access?
        folders = if params[:parent_id].present?
                    folders.where(parent_id: params[:parent_id])
                  else
                    folders.roots
                  end

        files = if params[:parent_id].present?
                  files.where(folder_id: params[:parent_id])
                else
                  files.where(folder_id: nil)
                end
      else
        # visible_ds_folders/files はArrayなので、Rubyメソッドでフィルタ
        folders = if params[:parent_id].present?
                    folders.select { |f| f.parent_id == params[:parent_id] }
                  else
                    folders.select { |f| f.parent_id.nil? }
                  end

        files = if params[:parent_id].present?
                  files.select { |f| f.folder_id == params[:parent_id] }
                else
                  files.select { |f| f.folder_id.nil? }
                end
      end

      breadcrumb = if params[:parent_id].present?
                     parent = folder_scope.find(params[:parent_id])
                     crumbs = parent.breadcrumb
                     # Userの場合、閲覧権限のあるフォルダのみをパンくずに含める
                     unless full_ds_access?
                       crumbs = crumbs.select { |f| folder_viewable?(f.id) }
                     end
                     crumbs.map { |f| { id: f.id, name: f.name } }
                   else
                     []
                   end

      sorted_folders = full_ds_access? ? folders.order(:name) : folders.sort_by(&:name)
      sorted_files = full_ds_access? ? files.order(updated_at: :desc) : files.sort_by { |f| f.updated_at }.reverse

      render json: {
        folders: sorted_folders.map { |f| folder_json(f) },
        files: sorted_files.map { |f| file_json(f) },
        breadcrumb: breadcrumb
      }
    end

    # POST /api/data_source_folders
    def create
      if params[:parent_id].present? && !folder_scope.exists?(id: params[:parent_id])
        render json: { success: false, errors: ["指定された親フォルダが見つかりません"] }, status: :unprocessable_entity
        return
      end

      folder = DataSourceFolder.new(folder_params)
      folder.company_id = if current_company_id.present?
                            current_company_id
                          elsif params[:parent_id].present?
                            folder_scope.find(params[:parent_id]).company_id
                          elsif params[:company_id].present?
                            params[:company_id]
                          end

      if folder.company_id.blank?
        message = if privileged_admin?
                    "特権管理者ではデータソースの作成はできません。企業管理者アカウントでログインしてください。"
                  else
                    "会社が指定されていません。会社を選択してください。"
                  end
        render json: { success: false, errors: [message] }, status: :unprocessable_entity
        return
      end

      folder.created_by = current_user

      if folder.save
        render json: { success: true, folder: folder_json(folder) }, status: :created
      else
        render json: { success: false, errors: folder.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/data_source_folders/:id
    def update
      if @folder.update(name: params[:name].to_s.delete("\u0000"))
        render json: { success: true, folder: folder_json(@folder) }
      else
        render json: { success: false, errors: @folder.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/data_source_folders/:id/move
    def move
      new_parent_id = params[:parent_id]
      error = validate_folder_move(@folder, new_parent_id, folder_scope)

      if error
        render json: { success: false, errors: [error] }, status: :unprocessable_entity
        return
      end

      # 移動先フォルダへのeditor権限チェック（Admin/CompanyAdminはスキップ）
      unless full_ds_access?
        if new_parent_id.present?
          dest = folder_scope.find_by(id: new_parent_id)
          unless dest&.editable_by?(current_user, session[:user_type])
            render json: { success: false, errors: ["移動先フォルダへの編集権限がありません"] }, status: :forbidden
            return
          end
        end
      end

      if @folder.update(parent_id: new_parent_id)
        render json: { success: true, folder: folder_json(@folder) }
      else
        render json: { success: false, errors: @folder.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # DELETE /api/data_source_folders/:id
    def destroy
      @folder.destroy
      render json: { success: true }
    end

    private

    # Admin または CompanyAdmin はフルアクセス（権限チェック不要）
    def full_ds_access?
      current_admin? || current_user_company_admin?
    end

    def set_folder
      @folder = folder_scope.find(params[:id])
    end

    def folder_scope
      privileged_admin? ? DataSourceFolder.all : DataSourceFolder.for_company(current_company_id)
    end

    def file_scope
      privileged_admin? ? DataSourceFile.all : DataSourceFile.for_company(current_company_id)
    end

    # --- N+1最適化: ユーザーの全DS権限をプリロードしてメモリ上で判定 ---

    # ユーザーの全DS権限を1クエリでロード（リクエスト中キャッシュ）
    # 個人権限 + UserGroup経由の権限の両方を含む
    def user_ds_permissions
      @user_ds_permissions ||= begin
        grantee_type = session[:user_type] == "admin" ? "Admin" : "User"
        # 個人権限
        personal = Permission.where(
          company_id: current_company_id,
          grantee_type: grantee_type,
          grantee_id: current_user.id,
          permissible_type: ["DataSourceFolder", "DataSourceFile"]
        ).pluck(:permissible_type, :permissible_id, :role)

        # UserGroup経由の権限
        if current_user.is_a?(User) && current_user.respond_to?(:user_group_ids)
          group_ids = current_user.user_group_ids
          if group_ids.present?
            group_perms = Permission.where(
              company_id: current_company_id,
              grantee_type: "UserGroup",
              grantee_id: group_ids,
              permissible_type: ["DataSourceFolder", "DataSourceFile"]
            ).pluck(:permissible_type, :permissible_id, :role)
            personal + group_perms
          else
            personal
          end
        else
          personal
        end
      end
    end

    # フォルダ親子マップ（全フォルダの parent_id をハッシュで保持）
    def folder_parent_map
      @folder_parent_map ||= folder_scope.pluck(:id, :parent_id).to_h
    end

    # 指定IDのフォルダの祖先チェーンを返す（自身を含む）
    def ancestor_folder_ids(folder_id)
      ids = []
      current_id = folder_id
      seen = Set.new  # 循環参照防止
      while current_id && !seen.include?(current_id)
        ids << current_id
        seen.add(current_id)
        current_id = folder_parent_map[current_id]
      end
      ids
    end

    # フォルダが閲覧可能か判定（プリロード済みデータで）
    # ※ このメソッドはUser専用パスからのみ呼ばれる（Adminはindex内で別パスを通る）
    # 祖先チェーン上に権限があるか、または子孫に権限があるフォルダの祖先であるかをチェック
    def folder_viewable?(folder_id)
      viewable_folder_ids.include?(folder_id)
    end

    # 閲覧可能なフォルダIDセット（リクエスト中キャッシュ）
    # 権限のあるフォルダ + その全祖先フォルダ + その全子孫フォルダ を含む
    def viewable_folder_ids
      @viewable_folder_ids ||= begin
        # ユーザーが権限を持つフォルダIDs
        perm_folder_ids = user_ds_permissions
          .select { |type, _id, _role| type == "DataSourceFolder" }
          .map { |_type, id, _role| id }
          .to_set

        result = Set.new

        # 各権限フォルダについて、祖先チェーンと子孫チェーンを追加
        perm_folder_ids.each do |fid|
          # 祖先チェーンを追加（親フォルダへのナビゲーションパス）
          ancestor_folder_ids(fid).each { |aid| result.add(aid) }
          # 子孫フォルダを追加（権限の継承）
          descendant_folder_ids(fid).each { |did| result.add(did) }
        end

        result
      end
    end

    # 指定フォルダの全子孫フォルダIDを返す
    def descendant_folder_ids(folder_id)
      # 逆引きマップ: parent_id → [child_ids]
      children_map = @children_map ||= begin
        map = Hash.new { |h, k| h[k] = [] }
        folder_parent_map.each { |id, pid| map[pid] << id }
        map
      end

      ids = []
      queue = [folder_id]
      seen = Set.new
      while queue.any?
        current = queue.shift
        next if seen.include?(current)
        seen.add(current)
        children = children_map[current]
        children.each do |child_id|
          ids << child_id
          queue << child_id
        end
      end
      ids
    end

    # Userが閲覧可能なフォルダ（プリロード済みで判定）
    def visible_ds_folders
      all_folders = folder_scope.to_a
      all_folders.select { |f| viewable_folder_ids.include?(f.id) }
    end

    # Userが閲覧可能なファイル（フォルダ経由の権限継承）
    def visible_ds_files
      all_files = file_scope.to_a
      # ファイルに直接権限がある、またはフォルダ経由で閲覧可能
      file_perm_ids = user_ds_permissions
        .select { |type, _id, _role| type == "DataSourceFile" }
        .map { |_type, id, _role| id }
        .to_set

      all_files.select do |f|
        file_perm_ids.include?(f.id) || (f.folder_id.present? && folder_viewable?(f.folder_id))
      end
    end

    def folder_params
      permitted = params.permit(:name, :parent_id)
      permitted[:name] = permitted[:name].to_s.delete("\u0000") if permitted[:name].present?
      permitted
    end

    def folder_json(folder)
      {
        id: folder.id,
        name: folder.name,
        parent_id: folder.parent_id,
        files_count: folder.files_count,
        type: "folder",
        created_at: folder.created_at,
        updated_at: folder.updated_at
      }
    end

    def file_json(file)
      {
        id: file.id,
        name: file.name,
        file_type: file.file_type,
        file_size: file.file_size,
        ai_status: file.ai_status,
        folder_id: file.folder_id,
        type: "file",
        created_at: file.created_at,
        updated_at: file.updated_at,
        updated_by_id: file.updated_by_id
      }
    end
  end
end
