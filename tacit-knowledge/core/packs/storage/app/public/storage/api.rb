module Storage
  class Api
    class << self
      # S3へファイルをアップロードする
      # @param file [ActionDispatch::Http::UploadedFile] アップロードファイル
      # @param path [String] S3保存先パス
      # @param model [ApplicationRecord, nil] CarrierWaveのモデル（store_dirの自動計算用）
      # @param extra_extensions [Array<String>] 追加許可拡張子
      # @return [Hash] { key:, url: }
      def upload(file, path, model: nil, extra_extensions: [])
        uploader = Storage::Uploader.new(model, extra_extensions)
        uploader.set_directory(path) if path.present?
        uploader.store!(file)

        { key: uploader.path || uploader.filename, url: uploader.url }
      end

      # 署名付きダウンロードURLを生成する
      # @param key [String] S3キー
      # @param expires_in [Integer] 有効期限（秒）
      # @param filename [String, nil] ダウンロード時のファイル名
      # @return [String, nil] 署名付きURL
      def presigned_url(key, expires_in: S3Client::PRESIGNED_URL_EXPIRATION, filename: nil)
        s3_client.presigned_url(key, expires_in: expires_in, filename: filename)
      end

      # S3オブジェクトを削除する
      # @param key [String] S3キー
      def delete(key)
        s3_client.delete_object(key)
      end

      # ファイルのメタデータを取得する
      # @param key [String] S3キー
      # @return [Hash] { content_type:, size:, original_filename: }
      def metadata(key)
        head = s3_client.head_object(key)
        {
          content_type: head.content_type,
          size: head.content_length,
          original_filename: head.metadata['original-filename']
        }
      end

      # CloudFront署名付き動画URLを生成する
      # @param key [String] S3キー
      # @param hls [Boolean] HLSストリーミング用かどうか
      # @return [String] 署名付きURL
      def signed_video_url(key, hls: false)
        cf = Storage::CloudfrontClient.new
        hls ? cf.signed_hls_url(key) : cf.signed_url(key)
      end

      # S3からファイルをダウンロードする
      # @param key [String] S3キー
      # @return [String] ファイル内容（バイナリ）
      def download(key)
        s3_client.download_file(key)
      end

      private

      def s3_client
        Storage::S3Client.new
      end
    end
  end
end
