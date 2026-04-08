module SkillrelayCore
  class EventBus
    class << self
      # 同期イベント発行（ActiveSupport::Notifications）
      def publish(event)
        raise ArgumentError, "must be a DomainEvent" unless event.is_a?(DomainEvent)

        ActiveSupport::Notifications.instrument(event.class.event_name, event: event)
        Rails.logger.info "[EventBus] Published: #{event.class.event_name}"
      end

      # 非同期イベント発行（SQS）
      def publish_async(event, action_type:)
        raise ArgumentError, "must be a DomainEvent" unless event.is_a?(DomainEvent)

        queue_url = ENV.fetch("SQS_DOCUMENT_PROCESSING_QUEUE_URL", nil)
        unless queue_url.present?
          Rails.logger.warn "[EventBus] SQS未設定のため非同期イベントをスキップ: #{event.class.event_name}"
          return
        end

        SkillrelayCore::SqsPublisher.publish(
          queue_url: queue_url,
          event: event,
          action_type: action_type
        )
      end

      # 同期イベント購読
      def subscribe(event_class, &block)
        ActiveSupport::Notifications.subscribe(event_class.event_name) do |_name, _start, _finish, _id, payload|
          block.call(payload[:event])
        end
      end
    end
  end
end
