class MessagesController < ApplicationController
  include TopicAccessControl

  skip_before_action :verify_authenticity_token, only: [:create, :index]
  before_action :set_room_for_permission, only: [:index, :create]
  before_action :require_room_topic_viewer, only: [:index, :create]

  def index
    room_id = params[:room_id]

    if room_id.present?
      room = Room.find_by(id: room_id)

      if room.nil?
        render json: { error: 'Room not found' }, status: :not_found
        return
      end

      room_request = room.request
      if room_request.nil? && room.chat_type != 'topic'
        render json: { error: 'Request not found for room' }, status: :not_found
        return
      end

      @messages = Message.where(room_id: room_id)
                        .order(:created_at)
                        .includes(:topic)

      formatted_messages = @messages.map do |message|
        {
          id: message.id,
          content: message.content,
          type: message.message_type,
          chat_type: message.chat_type,
          created_at: message.created_at.iso8601,
          updated_at: message.updated_at.iso8601,
          pbm_step: message.pbm_step,
          meta_json: message.meta_json || {}
        }
      end

      render json: {
        messages: formatted_messages,
        room_id: room_id,
        chat_type: room.chat_type,
        count: formatted_messages.length
      }
    else
      render json: { messages: [], count: 0 }
    end
  end

  def create
    room_id = params[:room_id] || message_params[:room_id]
    content = params[:content] || message_params[:content]
    message_type = params[:message_type] || message_params[:message_type] || 'user'
    
    if room_id.blank? || content.blank?
      respond_to do |format|
        format.html { redirect_to messages_url, notice: 'room_idとcontentが必要です。' }
        format.json { render json: { error: 'room_id and content are required' }, status: :bad_request }
      end
      return
    end

    begin
      room = Room.find_by(id: room_id)

      if room.nil?
        respond_to do |format|
          format.html { redirect_to messages_url, notice: 'ルームが見つかりません。' }
          format.json { render json: { error: 'Room not found' }, status: :not_found }
        end
        return
      end

      room_request = room.request
      topic = room.topic
      if room_request.nil? && room.chat_type != 'topic'
        respond_to do |format|
          format.html { redirect_to messages_url, notice: 'リクエストが見つかりません。' }
          format.json { render json: { error: 'Request not found for room' }, status: :not_found }
        end
        return
      end

      question_id = nil
      if message_type == 'user'
        last_system_message = Message.where(
          room_id: room_id,
          message_type: 'assistant'
        ).order(:created_at).last
        question_id = last_system_message&.id
      end

      pbm_step = params[:pbm_step] || message_params[:pbm_step]
      meta_json = params[:meta_json] || message_params[:meta_json]

      @message = Message.new(
        request: room_request,
        topic: topic || room_request&.topic,
        content: content,
        message_type: message_type,
        chat_type: room.chat_type,
        question_id: question_id,
        room_id: room_id,
        pbm_step: pbm_step,
        meta_json: meta_json || {}
      )

      respond_to do |format|
        if @message.save
          format.html { redirect_to message_url(@message) }
          format.json { 
            render json: {
              message: {
                id: @message.id,
                content: @message.content,
                type: @message.message_type,
                chat_type: @message.chat_type,
                created_at: @message.created_at.iso8601,
                updated_at: @message.updated_at.iso8601
              },
              room_id: room_id,
            }, status: :created 
          }
        else
          Rails.logger.error "Message validation failed: #{@message.errors.full_messages.join(', ')}"
          Rails.logger.error "Message attributes: #{@message.attributes}"
          format.html { render :new, status: :unprocessable_entity }
          format.json { render json: @message.errors, status: :unprocessable_entity }
        end
      end

    rescue => e
      Rails.logger.error "Error creating message: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      respond_to do |format|
        format.html { redirect_to messages_url, notice: 'メッセージの作成に失敗しました。' }
        format.json { render json: { error: 'Failed to create message' }, status: :internal_server_error }
      end
    end
  end

  private

    def set_message
      @message = Message.find(params[:id])
    end

    def message_params
      params.require(:message).permit(:topic_id, :request_id, :content, :message_type, :chat_type, :room_id, :question_id, :pbm_step, meta_json: {})
    end

    def set_room_for_permission
      room_id = params[:room_id] || params.dig(:message, :room_id)
      @room = Room.find_by(id: room_id) if room_id.present?
    end

    def require_room_topic_viewer
      return if current_admin?
      return unless @room

      topic = @room.topic || @room.request&.topic
      return if topic&.viewable_by?(current_user, session[:user_type])

      # requestに紐づくrespondentは自分のroomにアクセス可能
      return if @room.request&.respondent_id == current_user&.id

      deny_access
    end
end
