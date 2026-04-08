require "test_helper"

class SkillrelayCore::EventBusTest < ActiveSupport::TestCase
  class SampleEvent < SkillrelayCore::DomainEvent
    attribute :message, String
  end

  test "publishで同期イベントが発行される" do
    received = nil
    SkillrelayCore::EventBus.subscribe(SampleEvent) do |event|
      received = event
    end

    event = SampleEvent.new(message: "hello")
    SkillrelayCore::EventBus.publish(event)

    assert_not_nil received
    assert_equal "hello", received.message
  end

  test "DomainEvent以外を渡すとArgumentError" do
    assert_raises(ArgumentError) do
      SkillrelayCore::EventBus.publish("not an event")
    end
  end

  test "publish_asyncでSQS未設定時はスキップ" do
    event = SampleEvent.new(message: "hello")

    original = ENV["SQS_DOCUMENT_PROCESSING_QUEUE_URL"]
    ENV.delete("SQS_DOCUMENT_PROCESSING_QUEUE_URL")

    result = SkillrelayCore::EventBus.publish_async(event, action_type: "test")
    assert_nil result

    ENV["SQS_DOCUMENT_PROCESSING_QUEUE_URL"] = original if original
  end

  test "subscribeで複数リスナーを登録できる" do
    count = 0
    2.times do
      SkillrelayCore::EventBus.subscribe(SampleEvent) { |_| count += 1 }
    end

    SkillrelayCore::EventBus.publish(SampleEvent.new(message: "test"))
    assert_equal 2, count
  end
end
