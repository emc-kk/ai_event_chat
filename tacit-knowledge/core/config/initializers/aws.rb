# frozen_string_literal: true

require 'aws-sdk-core'

Aws.config.update(
  region: ENV.fetch('AWS_REGION', 'ap-northeast-1')
)

unless Rails.env.production?
  access_key_id = ENV.fetch('AWS_ACCESS_KEY_ID', '123')
  secret_access_key = ENV.fetch('AWS_SECRET_ACCESS_KEY', '123')

  config = {
    credentials: Aws::Credentials.new(access_key_id, secret_access_key)
  }

  if ENV['AWS_ENDPOINT_URL'].present?
    config[:endpoint] = ENV['AWS_ENDPOINT_URL']
  end

  Aws.config.update(config)
end

