require 'aws-sdk-sqs'

class SqsMessageService
  def initialize
    @sqs_client = Aws::SQS::Client.new
    @queue_url = ENV.fetch('SQS_DOCUMENT_PROCESSING_QUEUE_URL')
  end

  def send_message(request:, next_status:, action_type:)
    pending_documents = request.request_documents.where(status: :pending)
    document_ids = pending_documents.any? ? pending_documents.pluck(:id) : []

    ds_file_ids = request.request_data_source_links.pluck(:data_source_file_id)

    message = {
      request_id: request.id,
      document_ids: document_ids,
      data_source_file_ids: ds_file_ids,
      topic_id: request.topic_id,
      next_status: next_status,
      request_type: request.request_type,
      action_type: action_type,
      timestamp: Time.current.iso8601
    }.to_json

    response = @sqs_client.send_message(
      queue_url: @queue_url,
      message_body: message
    )

    Rails.logger.info "SQS message sent successfully: #{response.message_id}"
    response
  rescue => e
    Rails.logger.error "Failed to send SQS message: #{e.message}"
    raise
  end
end
