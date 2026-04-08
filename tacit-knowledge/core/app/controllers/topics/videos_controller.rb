class Topics::VideosController < Topics::ApplicationController
  include TopicAccessControl

  before_action :set_title, only: [:show, :update]
  before_action :require_topic_viewer, only: %i[ show status ]
  before_action :require_topic_editor, only: %i[ create update ]

  def show
    @manual = Manual.find(params[:manual_id])

    @chapters = if @manual.video_id.present?
                  @manual.chapters.where(request_document_id: @manual.video_id).order(:sequence)
                else
                  @manual.chapters.order(:sequence)
                end

    @transcriptions = if @manual.video_id.present?
                        @manual.transcriptions.where(request_document_id: @manual.video_id).order(:sequence)
                      else
                        @manual.transcriptions.order(:sequence)
                      end

    hls_video_key = @manual.hls_video_key
    if hls_video_key.present?
      @video_url = Storage::Api.signed_video_url(hls_video_key, hls: true)
    else
      video_key = @manual.input_video_key || @req_doc.key
      @video_url = Storage::Api.presigned_url(video_key)
    end
  end

  def create
    if params[:video][:file].blank?
      flash[:alert] = "動画ファイルが選択されていません。"
      redirect_to topic_manual_path(topic_id: params[:topic_id], id: params[:manual_id])
      return
    end

    manual = Manual.find(params[:manual_id])

    begin
      Request.transaction do
        @request = Request.new(topic_id: params[:topic_id], request_type: :manual, created_by_id: current_user.id, created_by_type: current_user.class.name)
        unless @request.save
          flash[:alert] = "ファイルのアップロードに失敗しました: #{@request.errors.full_messages.join("\n")}"
          redirect_to topic_manual_path(topic_id: params[:topic_id], id: params[:manual_id])
          return
        end

        upload_manual_file

        manual.update(request_id: @request.id)
        unless manual.save
          flash[:alert] = "ファイルのアップロードに失敗しました: #{manual.errors.full_messages.join("\n")}"
          redirect_to topic_manual_path(topic_id: params[:topic_id], id: params[:manual_id])
          return
        end

        if @request.request_documents.any?
          unless @request.save
            Rails.logger.error "Failed to save request_documents: #{@request.errors.full_messages.join(', ')}"
            raise ActiveRecord::Rollback
          end
        end
      end

      @request.update(status: :updating)
      SqsMessageService.new.send_message(request: @request, next_status: 'completed', action_type: 'manual_video_update') if ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
      flash[:notice] = '動画が正常にアップロードされました。'
      redirect_to topics_path
    rescue => e
      Rails.logger.error "Error creating request: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      flash[:alert] = "ファイルのアップロードに失敗しました: #{e.message}"
      redirect_to topic_manual_path(topic_id: params[:topic_id], id: params[:manual_id])
    end
  end

  def update
    if params[:video][:file].blank?
      flash[:alert] = "動画ファイルが選択されていません。"
      redirect_to topic_manual_video_path(topic_id: params[:topic_id], manual_id: params[:manual_id], id: params[:id])
      return
    end

    begin
      Request.transaction do
        @request = Request.new(topic_id: params[:topic_id], request_type: :manual, created_by_id: current_user.id, created_by_type: current_user.class.name)
        unless @request.save
          flash[:alert] = "ファイルのアップロードに失敗しました: #{@request.errors.full_messages.join("\n")}"
          redirect_to topic_manual_video_path(topic_id: params[:topic_id], manual_id: params[:manual_id], id: params[:id])
          return
        end

        upload_manual_file

        manual = Manual.find(params[:manual_id])
        manual.update(request_id: @request.id)
        unless manual.save
          flash[:alert] = "ファイルのアップロードに失敗しました: #{manual.errors.full_messages.join("\n")}"
          redirect_to topic_manual_video_path(topic_id: params[:topic_id], manual_id: params[:manual_id], id: params[:id])
          return
        end

        if @request.request_documents.any?
          unless @request.save
            Rails.logger.error "Failed to save request_documents: #{@request.errors.full_messages.join(', ')}"
            raise ActiveRecord::Rollback
          end
        end
      end

      @request.update(status: :updating)
      SqsMessageService.new.send_message(request: @request, next_status: 'completed', action_type: 'manual_video_update') if ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
      flash[:notice] = '動画が正常にアップロードされました。'
      redirect_to topics_path
    rescue => e
      Rails.logger.error "Error creating request: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")

      flash[:alert] = "ファイルのアップロードに失敗しました: #{e.message}"
      redirect_to topic_manual_video_path(topic_id: params[:topic_id], manual_id: params[:manual_id], id: params[:id])
    end
  end

  def status
    req = Request.find(params[:video_id])
    req_doc = req.request_documents.last
    render json: { status: req_doc.status }
  end

  private

  def set_title
    request_document_id = params[:id]
    @req_doc = RequestDocument.find(request_document_id)
    @movie_title = Storage::Api.metadata(@req_doc.key)[:original_filename]
    @title = "動画詳細"
  end

  def upload_manual_file
    file = params[:video][:file]
    return if file.blank?

    timestamp = Time.current.to_i
    dir_path = "request/#{@request.id}/uploads/#{timestamp}"

    Rails.logger.info "Uploading file to directory: #{dir_path}"

    video_extensions = %w(mp4 webm ogg ogv mov avi wmv flv mkv 3gp 3g2 m4v ts mpeg mpg)
    begin
      filename = file.respond_to?(:original_filename) ? file.original_filename : File.basename(file)
      Rails.logger.info "Processing file: #{filename}, class: #{file.class}"

      result = Storage::Api.upload(file, dir_path, model: @request, extra_extensions: video_extensions)
      s3_key = result[:key]

      Rails.logger.info "Successfully uploaded to S3: key=#{s3_key}"

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

      if s3_key.present?
        begin
          Storage::Api.delete(s3_key)
        rescue => cleanup_error
          Rails.logger.error "Failed to cleanup uploaded file: #{cleanup_error.message}"
        end
      end

      raise e
    end
  end

end
