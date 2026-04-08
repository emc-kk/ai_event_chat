class RequestContentsController < ApplicationController
  include TopicAccessControl

  before_action :set_request
  before_action :require_topic_editor

  def create
    @request_content = @request.request_contents.build(request_content_params)

    if @request_content.save
      @request.rooms.hearing.active.unfinished.update_all(is_finished: true)
      @request.update(status: :updating)
      
      begin
        if ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL', nil).present?
          SqsMessageService.new.send_message(
            request: @request,
            next_status: 'rehearing',
            action_type: 'rehearing_create'
          )
          Rails.logger.info "Rehearing context message sent to SQS (request_id: #{@request.id}, action_type: rehearing_create)"
        end
      rescue => e
        Rails.logger.error "Failed to send rehearing context message to SQS: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
      end
      
      respond_to do |format|
        format.html { redirect_to topics_path(@request), notice: 'ステータスが更新されました。' }
        format.json { render json: { success: true, message: 'ステータスが更新されました。' } }
      end
    else
      respond_to do |format|
        format.html { 
          flash.now[:alert] = 'コンテンツの作成に失敗しました。'
          render :new, status: :unprocessable_entity
        }
        format.json { render json: { success: false, errors: @request_content.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  private

  def set_request
    @request = Request.find(params[:request_id])
  end

  def request_content_params
    params.require(:request_content).permit(:comment)
  end
end
