class Topics::ManualsController < Topics::ApplicationController
  include TopicAccessControl

  before_action :set_topic
  before_action :require_topic_viewer, only: %i[ show ]
  before_action :require_topic_editor, only: %i[ new create update regenerate ]

  def new
    @manual = Manual.new
    @title = 'マニュアル新規作成'
  end

  def show
    @manual = Manual.find(params[:id])
    @title = 'マニュアル詳細'

    @is_video = false
    if @manual.video_id.present?
      @document = RequestDocument.find_by(id: @manual.video_id)
      s3_key = @document&.key
      if s3_key.present?
        content_type = Storage::Api.metadata(s3_key)[:content_type]
        @is_video = content_type.start_with?('video/') || content_type == 'application/x-mpegURL'
      end
    end
  end

  def create
    @manual = Manual.new(manual_params)

    begin
      Request.transaction do
        @request = Request.new(topic_id: params[:topic_id], request_type: :manual, created_by_id: current_user.id, created_by_type: current_user.class.name)
        unless @request.save
          @request.errors.each do |error|
            @manual.errors.add(:base, error.full_message)
          end
          render :new, status: :unprocessable_entity
          return
        end

        @manual.request_id = @request.id
        unless @manual.save
          render :new, status: :unprocessable_entity
          return
        end
      end

      link_data_source_files(@topic)
      link_data_source_files_to_request(@request)
      @request.update(status: :updating)
      SqsMessageService.new.send_message(request: @request, next_status: 'completed', action_type: 'manual_create') if ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
      flash[:notice] = 'マニュアルの作成が開始されました。'
      redirect_to topics_path
    rescue => e
      Rails.logger.error "Error creating request: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      @title = "マニュアル新規作成"
      flash[:alert] = "マニュアルの作成に失敗しました: #{e.message}"
      redirect_to new_topic_manual_path topic_id: params[:topic_id]
    end
  end

  def regenerate
    @manual = Manual.find(params[:id])

    @manual.update!(manual_template_id: params[:manual_template_id].presence)

    request = @manual.request
    request.update!(status: :updating)
    if ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
      SqsMessageService.new.send_message(request: request, next_status: 'completed', action_type: 'manual_create')
    end

    redirect_to topic_manual_path(@topic, @manual), notice: "マニュアルの再生成を開始しました。"
  end

  def update
    @manual = Manual.find(params[:id])
    if @manual.update(manual_update_params)
      render json: {
        success: true
      }
    else
      render json: {
        success: false, errors: @manual.errors.full_messages
      }
    end
  end

  private

  def set_topic
    @topic = Topic.find(params[:topic_id])
  end

  def manual_params
    permit_params = params.require(:manual).permit(:input_text, :manual_template_id)
    permit_params.merge(topic_id: params[:topic_id])
  end

  def manual_update_params
    params.require(:manual).permit(:body)
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

end
