# storage パック

## 責務
ファイル管理の統一APIレイヤー。S3/CloudFront操作を集約し、各BCに統一インターフェースを提供する。
テーブルは持たない（B案: APIレイヤーのみ。各BCがファイルテーブルを所有）。

## 依存先（package.yml参照）
- . (root): Rails環境、ENV設定

## 公開API（public/）
- Storage::Api.upload(file, path, extra_extensions: []) — S3アップロード
- Storage::Api.presigned_url(key, expires_in:, filename:) — ダウンロードURL生成
- Storage::Api.delete(key) — S3オブジェクト削除
- Storage::Api.metadata(key) — content_type, size等のメタデータ取得
- Storage::Api.signed_video_url(key, hls: false) — CloudFront署名URL
- Storage::Api.download(key) — ファイルダウンロード

## DBテーブル
なし

## S3ライフサイクル管理
各BCがモデルのafter_destroyでStorage::Api.delete(key)を呼ぶ責務を持つ。
