module Storage
  class CloudfrontClient
    def initialize
      @key_pair_id = ENV.fetch('CLOUDFRONT_PRIVATE_KEY_ID')
      @private_key = OpenSSL::PKey::RSA.new(ENV.fetch('CLOUDFRONT_PRIVATE_KEY').gsub('\\n', "\n"))
      @video_domain = ENV.fetch('VIDEO_URL', 'https://video.skillrelay.ai')
    end

    def signed_hls_url(s3_key)
      video_path = s3_key.sub(/\Avideos\//, '')
      base_url = "#{@video_domain}/#{video_path}"
      resource = "#{base_url.sub(/output\.m3u8$/, '')}*"
      generate_signed_url(base_url, resource)
    end

    def signed_url(s3_key)
      video_path = s3_key.sub(/\Avideos\//, '')
      base_url = "#{@video_domain}/#{video_path}"
      generate_signed_url(base_url, base_url)
    end

    private

    def generate_signed_url(url, resource)
      expires_at = Time.now.to_i + 1.hour.to_i

      policy = {
        'Statement' => [
          {
            'Resource' => resource,
            'Condition' => {
              'DateLessThan' => {
                'AWS:EpochTime' => expires_at
              }
            }
          }
        ]
      }.to_json

      encoded_policy = Base64.strict_encode64(policy).tr('+=/', '-_~')
      signature = sign_policy(policy)

      "#{url}?Policy=#{encoded_policy}&Signature=#{signature}&Key-Pair-Id=#{@key_pair_id}"
    end

    def sign_policy(policy)
      signature = @private_key.sign(OpenSSL::Digest::SHA1.new, policy)
      Base64.strict_encode64(signature).tr('+=/', '-_~')
    end
  end
end
