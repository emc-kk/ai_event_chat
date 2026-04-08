require 'aws-sdk-s3'

module Storage
  class S3Client
    PRESIGNED_URL_EXPIRATION = 3600 # 1 hour

    def initialize
      s3_options = {}
      s3_options[:force_path_style] = true if ENV['AWS_ENDPOINT_URL'].present?
      @s3_client = Aws::S3::Client.new(**s3_options)
      @bucket = ENV.fetch('AWS_S3_BUCKET', 'skill-relay-dev')
      @signer = Aws::S3::Presigner.new(client: @s3_client)
    end

    def presigned_url(key, expires_in: PRESIGNED_URL_EXPIRATION, filename: nil)
      raise ArgumentError, 'Key is required' unless key.present?

      params = {
        bucket: @bucket,
        key: key,
        expires_in: expires_in
      }

      if filename.present?
        params[:response_content_disposition] = "attachment; filename=\"#{filename}\""
      end

      @signer.presigned_url(:get_object, **params)
    rescue => e
      Rails.logger.error "Error generating presigned URL: #{e.message}"
      nil
    end

    def download_file(key)
      raise ArgumentError, 'Key is required' unless key.present?
      raise ArgumentError, 'AWS_S3_BUCKET is not configured' unless @bucket.present?

      response = @s3_client.get_object(bucket: @bucket, key: key)
      response.body.read
    rescue ArgumentError
      raise
    rescue Aws::S3::Errors::NoSuchKey
      Rails.logger.error "File not found in S3: #{key}"
      raise StandardError, "File not found in S3: #{key}"
    rescue => e
      Rails.logger.error "Error downloading file from S3: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      raise StandardError, "Failed to download file: #{e.message}"
    end

    def delete_object(key)
      raise ArgumentError, 'Key is required' unless key.present?

      @s3_client.delete_object(bucket: @bucket, key: key)
    rescue ArgumentError
      raise
    rescue => e
      Rails.logger.error "Error deleting S3 object: #{e.message}"
      raise StandardError, "Failed to delete file: #{e.message}"
    end

    def head_object(key)
      @s3_client.head_object(bucket: @bucket, key: key)
    end

    def upload_object(key, body, content_type: nil, metadata: {})
      params = { bucket: @bucket, key: key, body: body }
      params[:content_type] = content_type if content_type
      params[:metadata] = metadata if metadata.present?
      @s3_client.put_object(**params)
    end
  end
end
