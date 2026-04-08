class ChatFilesController < ApplicationController
  include TopicAccessControl

  skip_before_action :verify_authenticity_token, only: [:upload]
  before_action :require_chat_file_permission, only: [:upload]
  before_action :require_download_permission, only: [:download]

  def upload
    room_id = params[:room_id]
    message_id = params[:message_id]
    files = params[:files]
    
    unless room_id.present? && message_id.present?
      render json: { success: false, error: 'room_idとmessage_idが必要です' }, status: :bad_request
      return
    end
    
    unless files.present?
      render json: { success: false, error: 'ファイルがアップロードされていません' }, status: :bad_request
      return
    end
    
    begin
      room = Room.find_by(id: room_id)
      
      unless room
        render json: { success: false, error: 'ルームが見つかりません' }, status: :not_found
        return
      end
      
      request = room.request
      
      unless request
        render json: { success: false, error: 'リクエストが見つかりません' }, status: :not_found
        return
      end
      
      timestamp = Time.current.to_i
      directory_path = "#{request.class.to_s.underscore}/#{request.id}/chat_uploads/#{timestamp}"
      
      Rails.logger.info "Uploading #{files.size} files to directory: #{directory_path}"
      
      uploaded_files_data = []
      
      files.each do |file|
        begin
          filename = file.original_filename
          content_type = file.content_type
          file_size = file.size
          
          Rails.logger.info "Processing chat file upload: #{filename}, size: #{file_size}, type: #{content_type}"
          
          upload_result = Storage::Api.upload(file, directory_path, model: request)
          s3_key = upload_result[:key]
          s3_url = upload_result[:url]
          
          Rails.logger.info "Successfully uploaded to S3: key=#{s3_key}, url=#{s3_url}"
          
          file_data = {
            name: filename,
            type: content_type,
            size: file_size,
            url: s3_url,
            s3_key: s3_key,
            uploaded_at: Time.current.iso8601
          }
          
          uploaded_files_data << file_data
          
        rescue => e
          Rails.logger.error "Failed to upload file #{filename}: #{e.message}"
          Rails.logger.error e.backtrace.join("\n")
          
          render json: { success: false, error: "ファイルのアップロードに失敗しました: #{e.message}" }, status: :unprocessable_entity
          return
        end
      end
      
      render json: { 
        success: true, 
        files: uploaded_files_data,
        directory_path: directory_path
      }
      
    rescue => e
      Rails.logger.error "Error in chat file upload: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      render json: { 
        success: false, 
        error: "ファイルのアップロード処理中にエラーが発生しました: #{e.message}" 
      }, status: :internal_server_error
    end
  end

  def download
    s3_key = params[:s3_key]
    
    unless s3_key.present?
      render json: { success: false, error: 's3_keyが必要です' }, status: :bad_request
      return
    end
    
    begin
      meta = Storage::Api.metadata(s3_key)
      data = Storage::Api.download(s3_key)
      filename = File.basename(s3_key)

      send_data data,
                filename: filename,
                type: meta[:content_type],
                disposition: 'attachment'

    rescue StandardError => e
      if e.message.include?("File not found")
        render json: { success: false, error: 'ファイルが見つかりません' }, status: :not_found
      else
        Rails.logger.error "Error downloading file: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")

        render json: {
          success: false,
          error: "ファイルのダウンロードに失敗しました: #{e.message}"
        }, status: :internal_server_error
      end
    end
  end

  private

  # uploadはroom経由でトピック権限をチェック
  def require_chat_file_permission
    return if current_admin?

    room = Room.find_by(id: params[:room_id]) if params[:room_id].present?
    return unless room

    topic = room.topic || room.request&.topic
    return if topic&.viewable_by?(current_user, session[:user_type])

    # requestに紐づくrespondentは自分のroomにアクセス可能
    return if room.request&.respondent_id == current_user&.id

    deny_access
  end

  # downloadはs3_keyからファイルの所属を逆引きして権限チェック
  def require_download_permission
    return if current_admin?

    s3_key = params[:s3_key]
    return unless s3_key.present?

    # request_documents経由: s3_key → request → topic
    document = RequestDocument.find_by(key: s3_key)
    if document
      topic = document.request&.topic
      return if topic&.viewable_by?(current_user, session[:user_type])
      return if document.request&.respondent_id == current_user&.id
      deny_access
      return
    end

    # DBにマッチしない場合はアクセス拒否（不正なs3_key）
    deny_access
  end
end

