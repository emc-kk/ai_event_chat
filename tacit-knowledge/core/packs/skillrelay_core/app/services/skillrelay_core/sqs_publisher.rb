require "aws-sdk-sqs"

module SkillrelayCore
  class SqsPublisher
    def self.publish(queue_url:, event:, action_type:)
      new(queue_url).publish(event, action_type: action_type)
    end

    def initialize(queue_url)
      @queue_url = queue_url
      @sqs_client = Aws::SQS::Client.new
    end

    def publish(event, action_type:)
      message = event.to_h.merge(action_type: action_type).to_json

      response = @sqs_client.send_message(
        queue_url: @queue_url,
        message_body: message
      )

      Rails.logger.info "[EventBus] SQS message sent: #{event.class.event_name} (#{response.message_id})"
      response
    rescue => e
      Rails.logger.error "[EventBus] SQS send failed: #{e.message}"
      raise
    end
  end
end
