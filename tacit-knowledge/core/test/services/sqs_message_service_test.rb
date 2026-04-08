require "test_helper"
require "minitest/mock"

class SqsMessageServiceTest < ActiveSupport::TestCase
  setup do
    @mock_sqs_client = Minitest::Mock.new
    @queue_url = "https://sqs.ap-northeast-1.amazonaws.com/123456789/test-queue"

    ENV["SQS_DOCUMENT_PROCESSING_QUEUE_URL"] = @queue_url

    Aws::SQS::Client.stub(:new, @mock_sqs_client) do
      @service = SqsMessageService.new
    end
  end

  test "send_message sends message to SQS and returns response" do
    mock_request = build_mock_request(
      id: 1, topic_id: 10, request_type: "knowledge",
      pending_doc_ids: [], ds_file_ids: [100, 200]
    )

    sqs_response = OpenStruct.new(message_id: "msg-12345")

    @mock_sqs_client.expect(:send_message, sqs_response) do |params|
      body = JSON.parse(params[:message_body])
      params[:queue_url] == @queue_url &&
        body["request_id"] == 1 &&
        body["action_type"] == "create" &&
        body["next_status"] == "processing"
    end

    result = @service.send_message(
      request: mock_request,
      next_status: "processing",
      action_type: "create"
    )

    assert_equal "msg-12345", result.message_id
    @mock_sqs_client.verify
  end

  test "send_message includes document_ids when pending documents exist" do
    mock_request = build_mock_request(
      id: 2, topic_id: 20, request_type: "document",
      pending_doc_ids: [50, 51], ds_file_ids: [300]
    )

    sqs_response = OpenStruct.new(message_id: "msg-67890")

    @mock_sqs_client.expect(:send_message, sqs_response) do |params|
      body = JSON.parse(params[:message_body])
      body["document_ids"] == [50, 51]
    end

    result = @service.send_message(
      request: mock_request,
      next_status: "processing",
      action_type: "update"
    )

    assert_equal "msg-67890", result.message_id
    @mock_sqs_client.verify
  end

  test "send_message raises error on SQS failure" do
    mock_request = build_mock_request(
      id: 3, topic_id: 30, request_type: "knowledge",
      pending_doc_ids: [], ds_file_ids: []
    )

    @mock_sqs_client.expect(:send_message, nil) do |_params|
      raise Aws::SQS::Errors::ServiceError.new(nil, "SQS Error")
    end

    assert_raises(Aws::SQS::Errors::ServiceError) do
      @service.send_message(
        request: mock_request,
        next_status: "processing",
        action_type: "create"
      )
    end
  end

  private

  def build_mock_request(id:, topic_id:, request_type:, pending_doc_ids:, ds_file_ids:)
    pending_docs_relation = if pending_doc_ids.any?
      pending_relation = OpenStruct.new
      pending_relation.define_singleton_method(:any?) { true }
      pending_relation.define_singleton_method(:pluck) { |_col| pending_doc_ids }
      pending_relation
    else
      empty_relation = []
      empty_relation
    end

    request_documents = OpenStruct.new
    request_documents.define_singleton_method(:where) { |_args| pending_docs_relation }

    ds_links = OpenStruct.new
    ds_links.define_singleton_method(:pluck) { |_col| ds_file_ids }

    OpenStruct.new(
      id: id,
      topic_id: topic_id,
      request_type: request_type,
      request_documents: request_documents,
      request_data_source_links: ds_links
    )
  end
end
