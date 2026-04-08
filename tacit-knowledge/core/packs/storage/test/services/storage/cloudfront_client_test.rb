require "test_helper"

module Storage
  class CloudfrontClientTest < Minitest::Test
    def setup
      @rsa_key = OpenSSL::PKey::RSA.generate(2048)
      @key_pair_id = "KAPID12345"
      @video_domain = "https://video.example.com"

      ENV["CLOUDFRONT_PRIVATE_KEY_ID"] = @key_pair_id
      ENV["CLOUDFRONT_PRIVATE_KEY"] = @rsa_key.to_pem
      ENV["VIDEO_URL"] = @video_domain

      @service = Storage::CloudfrontClient.new
    end

    def test_signed_hls_url_generates_url_with_wildcard_policy
      s3_key = "videos/abc/output.m3u8"
      url = @service.signed_hls_url(s3_key)

      assert_includes url, "#{@video_domain}/abc/output.m3u8?"
      assert_includes url, "Policy="
      assert_includes url, "Signature="
      assert_includes url, "Key-Pair-Id=#{@key_pair_id}"
    end

    def test_signed_hls_url_strips_videos_prefix
      url = @service.signed_hls_url("videos/path/to/output.m3u8")
      assert_includes url, "#{@video_domain}/path/to/output.m3u8?"
      refute_includes url.split("?").first, "videos/"
    end

    def test_signed_url_generates_url_without_wildcard
      s3_key = "videos/abc/thumbnail.jpg"
      url = @service.signed_url(s3_key)

      assert_includes url, "#{@video_domain}/abc/thumbnail.jpg?"
      assert_includes url, "Policy="
      assert_includes url, "Signature="
      assert_includes url, "Key-Pair-Id=#{@key_pair_id}"
    end

    def test_signed_url_strips_videos_prefix
      url = @service.signed_url("videos/some/file.mp4")
      assert_includes url, "#{@video_domain}/some/file.mp4?"
      refute_includes url.split("?").first, "videos/"
    end
  end
end
