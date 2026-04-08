class TopicsController < ApplicationController
  before_action :set_topic, only: %i[ show edit update destroy chat ]
  before_action :require_topic_editor_permission, only: %i[ new create edit update destroy ]

  def index
    # ナレッジ作成中のまま停滞しているリクエストを自動回復
    Request.recover_stuck_updating

    @current_folder = params[:folder_id].present? ? folder_scope.find_by(id: params[:folder_id]) : nil
    @breadcrumb = @current_folder&.breadcrumb || []
    @subfolders = visible_subfolders(@current_folder)
    @companies = Company.status_active.order(:name) if privileged_admin?

    # 権限を持つUserにはAdminと同じフォルダ付きテーブルを表示
    @use_admin_table = admin_or_company_admin? || user_has_any_permission?

    base_scope = topic_scope
    base_scope = base_scope.where(folder_id: @current_folder&.id) if @use_admin_table

    @q = base_scope.ransack(params[:q])
    @q.sorts = 'created_at desc' if @q.sorts.empty?
    @topics = @q.result.includes(requests: :respondent).includes(manual: :request).page(params[:page])
    @title = @current_folder ? @current_folder.name : "トピック一覧"

    if @use_admin_table
      all_requests = @topics.flat_map(&:requests)
    else
      @requests = current_user.requests
                              .or(Request.generally_accessible)
                              .hearing_type
                              .includes(:topic)
                              .where(topics: { company_id: current_company_id })
                              .page(params[:page])
      all_requests = @requests.to_a
    end

    @updating_request_ids = all_requests.select(&:status_updating?).map(&:id)
    @has_updating_requests = @updating_request_ids.any?
  end

  def show
  end

  def new
    @topic = Topic.new(folder_id: params[:folder_id])
    @title = "トピック一覧に戻る"
    @back_path = topics_path
  end

  def edit
    @title = "トピック一覧に戻る"
    @back_path = topics_path
  end

  def create
    @topic = Topic.new(topic_params)
    @topic.company_id = if current_company_id.present?
                          current_company_id
                        elsif @topic.folder_id.present?
                          folder_scope.find(@topic.folder_id).company_id
                        elsif privileged_admin? && params.dig(:topic, :company_id).present?
                          params[:topic][:company_id]
                        end
    @topic.created_by = current_user

    if @topic.save
      link_data_source_files(@topic)
      redirect_to topics_url, notice: 'トピックが正常に作成されました。'
    else
      @title = "新規トピック作成"
      respond_to do |format|
        format.html { render :new, status: :unprocessable_entity }
      end
    end
  end

  def update
    # folder_idが変更される場合、移動先フォルダの権限をチェック
    new_folder_id = topic_params[:folder_id]
    if new_folder_id.present? && new_folder_id != @topic.folder_id && !admin_or_company_admin?
      dest_folder = folder_scope.find_by(id: new_folder_id)
      unless dest_folder&.editable_by?(current_user, session[:user_type])
        redirect_to topics_path, alert: "移動先フォルダへの編集権限がありません"
        return
      end
    end

    if @topic.update(topic_params)
      redirect_to topics_url, notice: 'トピックが正常に更新されました。'
    else
      @title = "トピック編集"
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @topic.destroy
    redirect_to topics_url, notice: 'トピックが正常に削除されました。'
  end

  def chat
    room = find_or_create_topic_room
    redirect_to room_path(room)
  end

  private

  def set_topic
    @topic = topic_scope.find(params[:id])
  end

  def topic_scope
    if privileged_admin?
      Topic.all
    elsif admin_or_company_admin?
      Topic.for_company(current_company_id)
    else
      # 一般ユーザー: リクエストで紐づくトピック + 権限で閲覧可能なトピック（個人 + グループ）
      group_ids = current_user.user_group_ids

      company_id = current_company_id
      by_request = Topic.joins(:requests)
                        .where(topics: { company_id: company_id })
                        .where(requests: { respondent_id: current_user.id })
      by_permission = Topic.joins(:permissions)
                           .where(topics: { company_id: company_id })
                           .where(permissions: { deleted_at: nil })
                           .where(
                             "(permissions.grantee_type = 'User' AND permissions.grantee_id = :user_id)" \
                             "#{group_ids.present? ? " OR (permissions.grantee_type = 'UserGroup' AND permissions.grantee_id IN (:group_ids))" : ""}",
                             user_id: current_user.id,
                             group_ids: group_ids.presence || [""]
                           )
      by_folder_permission = Topic.joins(folder: :permissions)
                                  .where(topics: { company_id: company_id })
                                  .where(permissions: { deleted_at: nil })
                                  .where(
                                    "(permissions.grantee_type = 'User' AND permissions.grantee_id = :user_id)" \
                                    "#{group_ids.present? ? " OR (permissions.grantee_type = 'UserGroup' AND permissions.grantee_id IN (:group_ids))" : ""}",
                                    user_id: current_user.id,
                                    group_ids: group_ids.presence || [""]
                                  )

      Topic.where(id: by_request.select(:id))
           .or(Topic.where(id: by_permission.select(:id)))
           .or(Topic.where(id: by_folder_permission.select(:id)))
           .distinct
    end
  end

  def find_or_create_topic_room
    existing_room = @topic.rooms.topic.active.order(created_at: :desc).first
    return existing_room if existing_room

    @topic.rooms.create!(
      chat_type: 'topic',
      topic_id: @topic.id,
      is_finished: false,
      is_deleted: false
    )
  end

  def link_data_source_files(topic)
    file_ids = params[:data_source_file_ids]
    return if file_ids.blank?

    company_id = topic.company_id
    files = DataSourceFile.where(id: file_ids, company_id: company_id, ai_status: :completed)
    files.each do |file|
      TopicDataSourceLink.create(
        topic: topic,
        data_source_file: file,
        linked_by: current_user
      )
    end
  end

  def topic_params
    params.require(:topic).permit(:name, :description, :summary, :folder_id, :icon_color).tap do |topic_params|
      topic_params[:folder_id] = nil if topic_params[:folder_id].blank?
    end
  end

  def request_scope
    scope = current_user.is_a?(User) ? current_user.requests : Request.joins(:respondent).where(users: { deleted_at: nil })
    scope.hearing_type
  end

  # トピックの作成・編集・削除にeditor以上の権限を要求
  # Admin / Company Admin は常に許可、User はトピックまたは所属フォルダに editor 以上の権限があれば許可
  def require_topic_editor_permission
    return if admin_or_company_admin?

    case action_name
    when "new", "create"
      # 新規作成: フォルダの権限をチェック
      folder_id = params[:folder_id] || params.dig(:topic, :folder_id)
      if folder_id.present?
        folder = folder_scope.find_by(id: folder_id)
        return if folder&.editable_by?(current_user, session[:user_type])
      end
    else
      # 編集・更新・削除: トピック自体の権限をチェック（直接 + フォルダ継承）
      return if @topic&.editable_by?(current_user, session[:user_type])
    end

    redirect_to topics_path, alert: "この操作を行う権限がありません"
  end

  # 一般ユーザーがトピック関連の権限を持っているか（フォルダナビ付きテーブルを表示するため）
  def user_has_any_permission?
    return false unless current_regular_user?

    group_ids = current_user.user_group_ids

    Permission.where(company_id: current_company_id, deleted_at: nil).where(
      "(grantee_type = 'User' AND grantee_id = :user_id)" \
      "#{group_ids.present? ? " OR (grantee_type = 'UserGroup' AND grantee_id IN (:group_ids))" : ""}",
      user_id: current_user.id,
      group_ids: group_ids.presence || [""]
    ).exists?
  end

  # 権限に基づいて表示可能なサブフォルダを取得
  def visible_subfolders(current_folder)
    folders = folder_scope.where(parent_id: current_folder&.id).order(:name)

    if admin_or_company_admin?
      folders
    else
      # 一般ユーザー: 権限が設定されているフォルダのみ表示
      user_type = session[:user_type]
      folders.select { |f| f.viewable_by?(current_user, user_type) }
    end
  end

  # privileged_admin は全フォルダ、それ以外は自社フォルダ
  def folder_scope
    privileged_admin? ? TopicFolder.all : TopicFolder.for_company(current_company_id)
  end
end
