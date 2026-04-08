# frozen_string_literal: true

CarrierWave.configure do |config|
  config.storage = :aws

  config.aws_bucket = ENV.fetch('AWS_S3_BUCKET', 'skill-relay-dev')
  config.aws_authenticated_url_expiration = 60 * 60 * 24 * 7
  config.aws_acl    = 'private'

  config.aws_attributes = -> { {
    expires: 1.week.from_now.httpdate,
    cache_control: 'max-age=604800'
  } }
  aws_region = ENV.fetch('AWS_REGION', 'ap-northeast-1')

  config.aws_credentials = {
    region: aws_region
  }

  unless Rails.env.production?
    config.aws_credentials.merge!(
      access_key_id:     ENV.fetch('AWS_ACCESS_KEY_ID', '123'),
      secret_access_key: ENV.fetch('AWS_SECRET_ACCESS_KEY', '123')
    )

    if ENV['AWS_ENDPOINT_URL'].present?
      config.aws_credentials[:endpoint] = ENV['AWS_ENDPOINT_URL']
      config.aws_credentials[:force_path_style] = true
    end
  end

  unless Rails.env.production?
    config.asset_host = ENV.fetch('BASE_STORAGE_PATH', 'http://localhost:3000')
  end
end
