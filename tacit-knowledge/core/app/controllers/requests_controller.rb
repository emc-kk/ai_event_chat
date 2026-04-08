class RequestsController < ApplicationController
  include TopicAccessControl

  before_action :set_request, only: %i[ show edit update destroy remove_document hearing finish_hearing qa_csv qa_data conflicts resolve_conflicts ]
  skip_before_action :verify_authenticity_token, only: [:update, :remove_document, :finish_hearing, :resolve_conflicts]
  before_action :load_requests_data, only: [:index]
  before_action :require_topic_editor, only: %i[ new create edit update destroy remove_document finish_hearing resolve_conflicts ]
  before_action :require_topic_viewer, only: %i[ show hearing qa_csv qa_data conflicts ]

  def index
    @requests = [ {title: "依頼されたヒアリング(未着手)", data: @requests_not_started, param_name: :requests_page }, { title: "ヒアリング履歴", data: @request_histories, is_history: true, param_name: :history_page }]
    @topics = current_user.is_a?(User) ? current_user.requests.flat_map(&:topic).map(&:name) : Topic.all.pluck(:name)
    @title = "ヒアリング管理"
  end

  def show
  end

  def new
    @request = Request.new
    set_new_data
  end

  def edit
    @title = "ヒアリング依頼編集"
    set_new_data
  end

  def create
    @request = Request.new(request_params)

    begin
      request_saved = false

      Request.transaction do
        if @request.save
          request_saved = true

          unless @request.request_contents.any?
            @request.request_contents.create(context: nil)
          end
        else
          set_new_data
          @title = "新規ヒアリング依頼"
          render :new, status: :unprocessable_entity
        end
      end

      if request_saved
        link_data_source_files(@request.topic)
        link_data_source_files_to_request(@request)
        @request.update(status: :updating)
        send_message(next_status: 'not_started', action_type: 'hearing_create')
        redirect_to topics_url, notice: 'ヒアリングが正常に作成されました。'
      end
    rescue => e
      Rails.logger.error "Error creating request: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      set_new_data
      @title = "新規ヒアリング依頼"
      @request = Request.new
      flash[:alert] = "ヒアリングの作成に失敗しました: #{e.message}"
      redirect_to new_request_path
    end
  end

  def update
    begin
      has_new_ds_files = params[:data_source_file_ids].present?

      if @request.update(update_params)
        if has_new_ds_files
          link_data_source_files(@request.topic)
          link_data_source_files_to_request(@request)
          send_message(next_status: 'not_started', action_type: 'hearing_update')
        end

        respond_to do |format|
          format.html { redirect_with_success_message }
          format.json { render json: { success: true, message: success_message } }
        end
      else
        respond_to do |format|
          format.html { handle_update_failure }
          format.json { render json: { success: false, message: 'ステータス更新に失敗しました。' }, status: :unprocessable_entity }
        end
      end
    rescue => e
      Rails.logger.error "Error updating request: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      respond_to do |format|
        format.html {
          redirect_to edit_request_path(@request), alert: "エラーが発生しました: #{e.message}"
        }
        format.json {
          render json: { success: false, message: "エラーが発生しました: #{e.message}" }, status: :unprocessable_entity
        }
      end
    end
  end

  def destroy
    @request.destroy
    redirect_to requests_url, notice: 'ユーザーが正常に削除されました。'
  end

  def remove_document
    document_id = params[:document_id]
    return handle_missing_document_id unless document_id.present?

    document = @request.request_documents.find_by(id: document_id)
    if document
      document.destroy
      redirect_to edit_request_path(@request), notice: 'ファイルが削除されました。'
    else
      redirect_to edit_request_path(@request), alert: "ファイルが見つかりません。"
    end
  end

  def hearing
    unless can_access_chat?(@request, 'hearing')
      redirect_to request_path(@request), alert: 'このステータスではヒアリング用チャットにアクセスできません。'
      return
    end

    if @request.status_not_started? || @request.status_rehearing?
      @request.update(status: :inhearing)
    end

    latest_request_content = @request.request_contents.order(:created_at).last
    room = find_or_create_room('hearing', latest_request_content&.id)
    redirect_to room_path(room)
  end

  def finish_hearing
    begin
      unfinished_hearing_rooms = @request.rooms.hearing.where(is_finished: false, is_deleted: false)

      if unfinished_hearing_rooms.empty?
        Rails.logger.warn "No unfinished hearing rooms found for request #{@request.id}"
        render json: { success: false, message: '未完了のヒアリングルームが見つかりません。' }, status: :unprocessable_entity
        return
      end

      @request.rooms.hearing.update_all(is_finished: true)
      @request.update(status: :updating)
      send_message(next_status: 'completed', action_type: 'hearing_finish')
      render json: { success: true, message: 'ヒアリングが終了しました。' }
    rescue => e
      Rails.logger.error "Error finishing hearing: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: { success: false, message: "エラーが発生しました: #{e.message}" }, status: :internal_server_error
    end
  end

  def qa_csv
    begin
      qa_response = AiServerClient.get_qa_data(@request.id)
      qa_data = qa_response[:data] || []

      if qa_data.empty?
        render json: { error: 'QA data not found' }, status: :not_found
        return
      end

      csv = CSV.generate(force_quotes: true, encoding: 'UTF-8') do |csv_row|
        csv_row << ['質問', 'キーワード/カテゴリ', '質問の意図', '関連する状況', '回答']
        qa_data.each do |row|
          csv_row << [
            row[:question],
            row[:keywordCategory],
            row[:questionIntent],
            row[:relatedSituation],
            row[:answer]
          ]
        end
      end

      send_data "\uFEFF" + csv,
                type: 'text/csv; charset=utf-8',
                disposition: 'attachment',
                filename: "knowledge_qa_#{@request.id}.csv"
    rescue StandardError => e
      Rails.logger.error "Error in qa_csv: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      render json: { error: e.message }, status: :internal_server_error
    end
  end

  def qa_data
    qa_response = AiServerClient.get_qa_data(@request.id)
    render json: qa_response
  rescue StandardError => e
    Rails.logger.error "Error in qa_data: #{e.message}"
    render json: { error: e.message, data: [], total: 0 }, status: :internal_server_error
  end

  def conflicts
    conflicts = CrossUserConflict.involving_request(@request.id).pending
    render json: {
      conflicts: conflicts.map { |c|
        {
          id: c.id,
          request_a_id: c.request_a_id,
          request_b_id: c.request_b_id,
          request_a_respondent: c.request_a.respondent&.name,
          request_b_respondent: c.request_b.respondent&.name,
          question_a: c.question_a,
          answer_a: c.answer_a,
          question_b: c.question_b,
          answer_b: c.answer_b,
          similarity: c.similarity,
          status: c.status
        }
      },
      total: conflicts.count
    }
  end

  def resolve_conflicts
    resolutions = params[:resolutions] || []

    begin
      ActiveRecord::Base.transaction do
        resolutions.each do |res|
          conflict = CrossUserConflict.find(res[:conflict_id])
          conflict.update!(
            status: res[:resolution],
            resolved_by: current_user || current_admin,
            resolution_note: res[:note]
          )
        end

        remaining = CrossUserConflict.involving_request(@request.id).pending.count
        if remaining == 0
          @request.update!(status: :completed)
        end
      end

      render json: { success: true, remaining: CrossUserConflict.involving_request(@request.id).pending.count }
    rescue => e
      Rails.logger.error "Error resolving conflicts: #{e.message}"
      render json: { success: false, message: e.message }, status: :unprocessable_entity
    end
  end

  def status
    request_ids = params[:ids] || []
    requests = accessible_requests(request_ids)

    requests_data = requests.map do |req|
      {
        id: req.id,
        status: req.status,
        can_access_hearing: can_access_chat?(req, 'hearing'),
        hearing_path: helpers.latest_room_path(req, 'hearing') || hearing_request_path(req),
        has_conflicts: req.has_pending_conflicts?,
        topic_id: req.topic_id
      }
    end

    # トピックステータスも返す（ポーリングでトピックチャットの有効化を反映するため）
    topic_ids = requests.map(&:topic_id).uniq.compact
    topics_data = Topic.where(id: topic_ids).map do |topic|
      {
        id: topic.id,
        status: topic.status,
        status_label: I18n.t("activerecord.attributes.topic.statuses.#{topic.status}"),
        chat_accessible: topic.chat_accessible?,
        chat_path: topic.chat_accessible? ? (helpers.latest_room_path(topic, 'topic') || chat_topic_path(topic)) : nil
      }
    end

    render json: {
      requests: requests_data,
      topics: topics_data,
      has_updating: requests.any?(&:status_updating?)
    }
  end

  private

    ALLOWED_HEARING_STATUSES = %i[not_started inhearing awaiting_verification rehearing completed].freeze

    helper_method :can_access_chat?

    def can_access_chat?(request_record, chat_type)
      status_sym = request_record.status.to_sym
      case chat_type.to_s
      when 'hearing'
        ALLOWED_HEARING_STATUSES.include?(status_sym)
      else
        false
      end
    end

    def find_or_create_room(chat_type, request_content_id)
      Room.find_or_create_for_chat(@request, chat_type, request_content_id)
    end

    def set_new_data
      @topics = topics_for_current_user
      @respondents = respondents_for_current_user
      @title = "新規ヒアリング依頼"
    end

    def topics_for_current_user
      if privileged_admin?
        Topic.all.pluck(:name, :id)
      elsif current_admin?
        Topic.for_company(current_company_id).pluck(:name, :id)
      elsif current_user_company_admin?
        # User型の会社管理者: 自社のトピックをヒアリング依頼で選択可能にする
        Topic.for_company(current_company_id).pluck(:name, :id)
      else
        # リクエスト経由のトピック + 権限で編集可能なトピック
        by_request = current_user.requests.includes(:topic).flat_map(&:topic).compact
        by_permission = Topic.joins(:permissions)
                             .where(permissions: { grantee_type: "User", grantee_id: current_user.id, deleted_at: nil })
                             .where(permissions: { role: [:editor, :owner] })
        by_folder_permission = Topic.joins(folder: :permissions)
                                    .where(permissions: { grantee_type: "User", grantee_id: current_user.id, deleted_at: nil })
                                    .where(permissions: { role: [:editor, :owner] })

        (by_request + by_permission.to_a + by_folder_permission.to_a).uniq.map { |t| [t.name, t.id] }
      end
    end

    def respondents_for_current_user
      if privileged_admin?
        User.find_veterans.pluck(:name, :id)
      else
        User.find_veterans.where(company_id: current_company_id).pluck(:name, :id)
      end
    end

    def set_request
      @request = Request.find(params[:id])
    end

    def load_requests_data
      base_scope = current_user.is_a?(User) ? current_user.requests : Request
      base_scope = base_scope.hearing_type

      @requests_not_started = base_scope
        .status_except([:completed, :awaiting_verification])
        .page(params[:requests_page])

      @request_histories = base_scope
        .status_history
        .page(params[:history_page])
    end

    def redirect_with_success_message
      redirect_to request_path(@request), notice: success_message
    end

    def handle_update_failure
      @title = "ヒアリング依頼編集"
      set_new_data
      render :edit, status: :unprocessable_entity
    end

    def success_message
      if finish_hearing_request?
        'ヒアリングが終了しました。'
      else
        'ステータスが更新されました。'
      end
    end

    def request_params
      permit_params = params.require(:request).permit(:name, :description, :topic_id, :respondent_id, :room_id, :status)
      permit_params.merge(created_by_id: current_user.id, created_by_type: current_user.class.name, request_type: :hearing)
    end
    
    def document_files_params
      params[:request][:document_files] if params[:request]
    end

    def handle_document_uploads
      files = document_files_params
      
      return unless files.present?
      
      files = files.reject(&:blank?)
      return if files.empty?

      timestamp = Time.current.to_i
      directory_path = "#{@request.class.to_s.underscore}/#{@request.id}/uploads/#{timestamp}"
      
      Rails.logger.info "Uploading #{files.size} files to directory: #{directory_path}"
      
      uploaded_files = []
      
      files.each do |file|
        begin
          filename = file.respond_to?(:original_filename) ? file.original_filename : File.basename(file)
          Rails.logger.info "Processing file: #{filename}, class: #{file.class}"
          
          result = Storage::Api.upload(file, directory_path, model: @request)
          s3_key = result[:key]

          Rails.logger.info "Successfully uploaded to S3: key=#{s3_key}"

          uploaded_files << s3_key
          
          file_type = File.extname(filename).delete('.').downcase

          @request.request_documents.build(
            key: s3_key,
            status: :pending,
            file_type: file_type
          )
          
          Rails.logger.info "Document record created"
        rescue => e
          Rails.logger.error "Failed to upload document #{filename}: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          
          uploaded_files.each do |key|
            begin
              Storage::Api.delete(key)
            rescue => cleanup_error
              Rails.logger.error "Failed to cleanup uploaded file: #{cleanup_error.message}"
            end
          end
          
          raise e
        end
      end
    end

    def handle_missing_document_id
      redirect_to edit_request_path(@request), alert: "ファイルIDが指定されていません。"
    end

    # statusアクション用: ユーザーがアクセスできるリクエストのみ返す
    def accessible_requests(request_ids)
      base = Request.where(id: request_ids)
      return base if current_admin?

      if current_user.is_a?(User)
        # 自分がrespondentのリクエスト + トピック権限で閲覧可能なリクエスト
        by_respondent = base.where(respondent_id: current_user.id)
        by_topic_perm = base.joins(:topic).merge(
          Topic.joins(:permissions)
               .where(permissions: { grantee_type: "User", grantee_id: current_user.id, deleted_at: nil })
        )
        by_folder_perm = base.joins(topic: :folder).merge(
          TopicFolder.joins(:permissions)
                     .where(permissions: { grantee_type: "User", grantee_id: current_user.id, deleted_at: nil })
        )
        Request.where(id: by_respondent.select(:id))
               .or(Request.where(id: by_topic_perm.select(:id)))
               .or(Request.where(id: by_folder_perm.select(:id)))
      else
        base
      end
    end

    def hearing_accessible?
      can_access_chat?(@request, 'hearing')
    end

    def link_data_source_files(topic)
      file_ids = params[:data_source_file_ids]
      return if file_ids.blank? || topic.blank?

      files = DataSourceFile.where(id: file_ids, company_id: topic.company_id, ai_status: :completed)
      files.each do |file|
        TopicDataSourceLink.find_or_create_by(
          topic: topic,
          data_source_file: file
        ) { |link| link.linked_by = current_user }
      end
    end

    def link_data_source_files_to_request(request)
      file_ids = params[:data_source_file_ids]
      return if file_ids.blank? || request.blank?

      files = DataSourceFile.where(id: file_ids, company_id: request.topic.company_id, ai_status: :completed)
      files.each do |file|
        RequestDataSourceLink.find_or_create_by(
          request: request,
          data_source_file: file
        ) { |link| link.linked_by = current_user }
      end
    end

    def send_message(next_status:, action_type:)
      unless ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
        # SQSが未設定の場合、ステータスを直接next_statusに戻す（updatingのままにしない）
        @request.update(status: next_status)
        return
      end

      begin
        SqsMessageService.new.send_message(
          request: @request,
          next_status: next_status,
          action_type: action_type
        )
      rescue => e
        Rails.logger.error "SQS send failed, falling back to direct status update: #{e.message}"
        @request.update(status: next_status)
      end
    end

end
