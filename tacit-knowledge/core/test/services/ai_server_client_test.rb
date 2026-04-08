require "test_helper"
require "minitest/mock"

class AiServerClientTest < ActiveSupport::TestCase
  setup do
    # Reset memoized connection between tests
    AiServerClient.instance_variable_set(:@connection, nil)
  end

  test "get_qa_data returns body on success" do
    expected_body = { data: [{ question: "Q1", answer: "A1" }], total: 1 }

    stub_connection = Faraday.new do |builder|
      builder.adapter :test do |stub|
        stub.get("/api/knowledge-hearing-qa") do |env|
          assert_equal "123", env.params["request_id"]
          [200, { "Content-Type" => "application/json" }, expected_body.to_json]
        end
      end
      builder.response :json, parser_options: { symbolize_names: true }
    end

    AiServerClient.instance_variable_set(:@connection, stub_connection)
    result = AiServerClient.get_qa_data("123")
    assert_equal expected_body, result
  end

  test "get_qa_data returns empty data on failure response" do
    stub_connection = Faraday.new do |builder|
      builder.adapter :test do |stub|
        stub.get("/api/knowledge-hearing-qa") do
          [500, { "Content-Type" => "application/json" }, '{"error":"Internal Server Error"}']
        end
      end
      builder.response :json, parser_options: { symbolize_names: true }
    end

    AiServerClient.instance_variable_set(:@connection, stub_connection)
    result = AiServerClient.get_qa_data("123")
    assert_equal({ data: [], total: 0 }, result)
  end

  test "get_qa_data returns empty data on connection error" do
    stub_connection = Faraday.new do |builder|
      builder.adapter :test do |stub|
        stub.get("/api/knowledge-hearing-qa") do
          raise Faraday::ConnectionFailed, "Connection refused"
        end
      end
    end

    AiServerClient.instance_variable_set(:@connection, stub_connection)
    result = AiServerClient.get_qa_data("123")
    assert_equal({ data: [], total: 0 }, result)
  end
end
