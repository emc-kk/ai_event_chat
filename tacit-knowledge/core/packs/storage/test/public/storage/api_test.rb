require "test_helper"
require "minitest/mock"

module Storage
  class ApiTest < Minitest::Test
    def setup
      @mock_s3_client = Minitest::Mock.new
    end

    def test_presigned_url_delegates_to_s3_client
      @mock_s3_client.expect(:presigned_url, "https://signed.url") do |key, **kwargs|
        key == "test/file.pdf" && kwargs[:expires_in] == 3600 && kwargs[:filename].nil?
      end

      Storage::S3Client.stub(:new, @mock_s3_client) do
        result = Storage::Api.presigned_url("test/file.pdf")
        assert_equal "https://signed.url", result
      end
      @mock_s3_client.verify
    end

    def test_presigned_url_passes_filename
      @mock_s3_client.expect(:presigned_url, "https://signed.url") do |key, **kwargs|
        key == "test/file.pdf" && kwargs[:filename] == "report.pdf"
      end

      Storage::S3Client.stub(:new, @mock_s3_client) do
        result = Storage::Api.presigned_url("test/file.pdf", filename: "report.pdf")
        assert_equal "https://signed.url", result
      end
      @mock_s3_client.verify
    end

    def test_delete_delegates_to_s3_client
      @mock_s3_client.expect(:delete_object, true, ["test/file.pdf"])

      Storage::S3Client.stub(:new, @mock_s3_client) do
        Storage::Api.delete("test/file.pdf")
      end
      @mock_s3_client.verify
    end

    def test_metadata_returns_content_type_size_original_filename
      head_response = OpenStruct.new(
        content_type: "application/pdf",
        content_length: 2048,
        metadata: { "original-filename" => "report.pdf" }
      )
      @mock_s3_client.expect(:head_object, head_response, ["test/file.pdf"])

      Storage::S3Client.stub(:new, @mock_s3_client) do
        result = Storage::Api.metadata("test/file.pdf")
        assert_equal "application/pdf", result[:content_type]
        assert_equal 2048, result[:size]
        assert_equal "report.pdf", result[:original_filename]
      end
      @mock_s3_client.verify
    end

    def test_download_delegates_to_s3_client
      @mock_s3_client.expect(:download_file, "binary data", ["test/file.pdf"])

      Storage::S3Client.stub(:new, @mock_s3_client) do
        result = Storage::Api.download("test/file.pdf")
        assert_equal "binary data", result
      end
      @mock_s3_client.verify
    end

    def test_upload_delegates_to_uploader
      mock_uploader = Minitest::Mock.new
      mock_file = OpenStruct.new(original_filename: "report.pdf")

      mock_uploader.expect(:set_directory, nil, ["uploads/docs"])
      mock_uploader.expect(:store!, nil, [mock_file])
      mock_uploader.expect(:path, "uploads/docs/report.pdf")
      mock_uploader.expect(:url, "https://s3.example.com/uploads/docs/report.pdf")

      Storage::Uploader.stub(:new, mock_uploader) do
        result = Storage::Api.upload(mock_file, "uploads/docs")
        assert_equal "uploads/docs/report.pdf", result[:key]
        assert_equal "https://s3.example.com/uploads/docs/report.pdf", result[:url]
      end
      mock_uploader.verify
    end

    def test_upload_without_path_does_not_set_directory
      mock_uploader = Minitest::Mock.new
      mock_file = OpenStruct.new(original_filename: "report.pdf")

      mock_uploader.expect(:store!, nil, [mock_file])
      mock_uploader.expect(:path, "report.pdf")
      mock_uploader.expect(:url, "https://s3.example.com/report.pdf")

      Storage::Uploader.stub(:new, mock_uploader) do
        result = Storage::Api.upload(mock_file, nil)
        assert_equal "report.pdf", result[:key]
      end
      mock_uploader.verify
    end

    def test_upload_falls_back_to_filename_when_path_is_nil
      mock_uploader = Minitest::Mock.new
      mock_file = OpenStruct.new(original_filename: "report.pdf")

      mock_uploader.expect(:set_directory, nil, ["uploads/docs"])
      mock_uploader.expect(:store!, nil, [mock_file])
      mock_uploader.expect(:path, nil)
      mock_uploader.expect(:filename, "report.pdf")
      mock_uploader.expect(:url, "https://s3.example.com/report.pdf")

      Storage::Uploader.stub(:new, mock_uploader) do
        result = Storage::Api.upload(mock_file, "uploads/docs")
        assert_equal "report.pdf", result[:key]
      end
      mock_uploader.verify
    end

    def test_upload_with_extra_extensions
      mock_uploader = Minitest::Mock.new
      mock_file = OpenStruct.new(original_filename: "image.png")

      mock_uploader.expect(:set_directory, nil, ["uploads/images"])
      mock_uploader.expect(:store!, nil, [mock_file])
      mock_uploader.expect(:path, "uploads/images/image.png")
      mock_uploader.expect(:url, "https://s3.example.com/uploads/images/image.png")

      Storage::Uploader.stub(:new, mock_uploader) do
        result = Storage::Api.upload(mock_file, "uploads/images", extra_extensions: ["png", "jpg"])
        assert_equal "uploads/images/image.png", result[:key]
      end
      mock_uploader.verify
    end

    def test_signed_video_url_delegates_to_cloudfront_client
      mock_cf_client = Minitest::Mock.new
      mock_cf_client.expect(:signed_url, "https://video.example.com/abc/thumbnail.jpg?Policy=xxx", ["videos/abc/thumbnail.jpg"])

      Storage::CloudfrontClient.stub(:new, mock_cf_client) do
        url = Storage::Api.signed_video_url("videos/abc/thumbnail.jpg")
        assert_equal "https://video.example.com/abc/thumbnail.jpg?Policy=xxx", url
      end
      mock_cf_client.verify
    end

    def test_signed_video_url_with_hls_delegates_to_cloudfront_client
      mock_cf_client = Minitest::Mock.new
      mock_cf_client.expect(:signed_hls_url, "https://video.example.com/abc/output.m3u8?Policy=xxx", ["videos/abc/output.m3u8"])

      Storage::CloudfrontClient.stub(:new, mock_cf_client) do
        url = Storage::Api.signed_video_url("videos/abc/output.m3u8", hls: true)
        assert_equal "https://video.example.com/abc/output.m3u8?Policy=xxx", url
      end
      mock_cf_client.verify
    end
  end
end
