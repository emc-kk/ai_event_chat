require "test_helper"
require "minitest/mock"

module Storage
  class S3ClientTest < Minitest::Test
    def setup
      @mock_client = Minitest::Mock.new
      @mock_signer = Minitest::Mock.new

      Aws::S3::Client.stub(:new, @mock_client) do
        Aws::S3::Presigner.stub(:new, @mock_signer) do
          @service = Storage::S3Client.new
        end
      end
    end

    def test_presigned_url_generates_a_signed_url
      @mock_signer.expect(:presigned_url, "https://s3.example.com/signed-url") do |method, **kwargs|
        method == :get_object &&
          kwargs[:bucket] == "skill-relay-dev" &&
          kwargs[:key] == "test/file.pdf" &&
          kwargs[:expires_in] == 3600
      end

      result = @service.presigned_url("test/file.pdf")
      assert_equal "https://s3.example.com/signed-url", result
      @mock_signer.verify
    end

    def test_presigned_url_with_filename_sets_content_disposition
      @mock_signer.expect(:presigned_url, "https://s3.example.com/signed-url") do |method, **kwargs|
        method == :get_object &&
          kwargs[:response_content_disposition] == 'attachment; filename="report.pdf"'
      end

      result = @service.presigned_url("test/file.pdf", filename: "report.pdf")
      assert_equal "https://s3.example.com/signed-url", result
      @mock_signer.verify
    end

    def test_presigned_url_returns_nil_when_key_is_blank
      assert_nil @service.presigned_url("")
      assert_nil @service.presigned_url(nil)
    end

    def test_download_file_returns_file_content
      body_mock = StringIO.new("file content here")
      response_mock = OpenStruct.new(body: body_mock)

      @mock_client.expect(:get_object, response_mock) do |**kwargs|
        kwargs[:bucket] == "skill-relay-dev" && kwargs[:key] == "test/file.pdf"
      end

      result = @service.download_file("test/file.pdf")
      assert_equal "file content here", result
      @mock_client.verify
    end

    def test_download_file_raises_on_no_such_key
      @mock_client.expect(:get_object, nil) do |**_kwargs|
        raise Aws::S3::Errors::NoSuchKey.new(nil, "No such key")
      end

      error = assert_raises(StandardError) { @service.download_file("missing.pdf") }
      assert_includes error.message, "File not found in S3"
    end

    def test_download_file_raises_argument_error_when_key_is_blank
      assert_raises(ArgumentError) { @service.download_file("") }
    end

    def test_delete_object_deletes_from_s3
      @mock_client.expect(:delete_object, true) do |**kwargs|
        kwargs[:bucket] == "skill-relay-dev" && kwargs[:key] == "test/file.pdf"
      end

      @service.delete_object("test/file.pdf")
      @mock_client.verify
    end

    def test_delete_object_raises_argument_error_when_key_is_blank
      assert_raises(ArgumentError) { @service.delete_object("") }
    end

    def test_head_object_returns_s3_head_response
      response_mock = OpenStruct.new(content_type: "application/pdf", content_length: 1024)
      @mock_client.expect(:head_object, response_mock) do |**kwargs|
        kwargs[:bucket] == "skill-relay-dev" && kwargs[:key] == "test/file.pdf"
      end

      result = @service.head_object("test/file.pdf")
      assert_equal "application/pdf", result.content_type
      @mock_client.verify
    end

    def test_upload_object_puts_object_to_s3
      @mock_client.expect(:put_object, true) do |**kwargs|
        kwargs[:bucket] == "skill-relay-dev" &&
          kwargs[:key] == "test/upload.pdf" &&
          kwargs[:body] == "binary data" &&
          kwargs[:content_type] == "application/pdf"
      end

      @service.upload_object("test/upload.pdf", "binary data", content_type: "application/pdf")
      @mock_client.verify
    end
  end
end
