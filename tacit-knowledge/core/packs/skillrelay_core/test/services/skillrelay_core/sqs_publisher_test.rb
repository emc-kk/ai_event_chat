require "test_helper"
require "minitest/mock"

class SkillrelayCore::SqsPublisherTest < ActiveSupport::TestCase
  class TestEvent < SkillrelayCore::DomainEvent
    attribute :request_id, Integer
  end

  test "publishでSQSにメッセージ送信される" do
    mock_client = Minitest::Mock.new
    sqs_response = OpenStruct.new(message_id: "test-msg-id")

    mock_client.expect(:send_message, sqs_response) do |params|
      body = JSON.parse(params[:message_body])
      params[:queue_url] == "https://test-queue" &&
        body["request_id"] == 42 &&
        body["action_type"] == "hearing_create"
    end

    Aws::SQS::Client.stub(:new, mock_client) do
      event = TestEvent.new(request_id: 42)
      SkillrelayCore::SqsPublisher.publish(
        queue_url: "https://test-queue",
        event: event,
        action_type: "hearing_create"
      )
    end

    mock_client.verify
  end

  test "SQSエラー時は例外がraiseされる" do
    mock_client = Minitest::Mock.new
    mock_client.expect(:send_message, nil) do |_|
      raise Aws::SQS::Errors::ServiceError.new(nil, "SQS Error")
    end

    Aws::SQS::Client.stub(:new, mock_client) do
      assert_raises(Aws::SQS::Errors::ServiceError) do
        SkillrelayCore::SqsPublisher.publish(
          queue_url: "https://test-queue",
          event: TestEvent.new(request_id: 1),
          action_type: "test"
        )
      end
    end
  end
end
