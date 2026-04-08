# ファイル管理テーブル分析

## 概要

モジュール化にあたり、ファイル管理関連のテーブル設計を棚卸しした結果。
Storage パック新設の判断材料として使用する。

---

## ファイル管理テーブル一覧

### 1. request_documents

| 項目 | 内容 |
|------|------|
| 用途 | ヒアリング時の参考資料（PDF等）+ マニュアル用動画ファイル |
| 作成タイミング | request作成/更新時、マニュアル動画アップロード時 |
| ファイル関連カラム | `key`（S3キー）, `parsed_document_key`（パース済S3キー）, `file_type`, `status` |
| FK | `request_id` → requests |
| 設計評価 | requestに密結合。将来他のBCからファイル管理したい場合に汎用性がない。S3削除コールバックなし |

### 2. message_files

| 項目 | 内容 |
|------|------|
| 用途 | チャットメッセージの添付ファイル |
| 作成タイミング | チャットでファイル送信時（のはず） |
| ファイル関連カラム | `file_path`（S3キー）, `file_name`, `content_type`, `file_size` |
| FK | `message_id` → messages |
| 設計評価 | **テーブル定義はあるがレコードが書き込まれていない。** ChatFilesControllerはS3にアップロードしてURLを返すだけで、message_filesにレコードを保存していない |

### 3. manuals

| 項目 | 内容 |
|------|------|
| 用途 | 動画からAI生成するマニュアル |
| 作成タイミング | マニュアル作成時 |
| ファイル関連カラム | `input_video_key`（元動画S3キー）, `hls_video_key`（HLS変換後S3キー）, `video_id`（→ request_documentsへのFK） |
| FK | `topic_id`, `request_id`, `video_id` → request_documents |
| 設計評価 | **S3キー直持ち + request_documents FKの二重参照が冗長** |

### 4. chapters

| 項目 | 内容 |
|------|------|
| 用途 | 動画チャプターのサムネイル |
| 作成タイミング | 動画処理時にworkerが生成 |
| ファイル関連カラム | `thumbnail_path`（S3パス） |
| FK | `manual_id`, `request_document_id` |
| 設計評価 | S3キーが直接入っている |

### 5. transcriptions

| 項目 | 内容 |
|------|------|
| 用途 | 動画の字幕テキスト |
| 作成タイミング | 動画処理時にworkerが生成 |
| ファイル関連カラム | なし（テキストデータのみ） |
| FK | `manual_id`, `request_document_id` |
| 設計評価 | ファイル参照はFKのみ。問題なし |

### 6. requests

| 項目 | 内容 |
|------|------|
| ファイル関連カラム | `chart_path` |
| 設計評価 | **未使用デッドカラム。** コード上で読み書きされていない |

---

## S3ディレクトリ構造

| 用途 | パス |
|------|------|
| ドキュメントアップロード | `request/{request_id}/uploads/{timestamp}/` |
| チャットファイル | `request/{request_id}/chat_uploads/{timestamp}/` |
| マニュアル動画 | `request/{request_id}/uploads/{timestamp}/` |

---

## 総合的な問題点

### 1. S3キーの持ち方が統一されていない

| テーブル | カラム名 |
|---------|---------|
| request_documents | `key` |
| message_files | `file_path` |
| manuals | `input_video_key`, `hls_video_key` |
| chapters | `thumbnail_path` |
| requests | `chart_path` |

### 2. message_filesが機能していない

テーブル定義のみ存在。ChatFilesControllerはS3アップロード→URL返却のみで、DBにレコードを保存していない。

### 3. manualsの二重参照

`input_video_key`（S3キー直持ち）と `video_id`（request_documentsへのFK）が共存。どちらが正なのか曖昧。

### 4. S3オブジェクトのライフサイクル管理がない

レコード削除時にS3オブジェクトを削除するコールバックがどのモデルにもない。孤立ファイルが蓄積する。

### 5. ActiveStorageが未使用

migrationでActiveStorage系テーブル（`active_storage_blobs`, `active_storage_attachments`, `active_storage_variant_records`）が作成されているが、アプリケーションコードからは一切参照されていない。実際のファイル管理はCarrierWave（`DocumentsUploader`）+ S3直接操作で行われている。デッドテーブルとして削除候補。

### 6. request_documentsがrequestに密結合

`request_id` FKが必須のため、request以外のコンテキスト（例: topicチャットのファイル、将来のweb_monitorの成果物等）からは使えない。

---

## 決定事項

| 項目 | 決定内容 |
|------|---------|
| Storage方針 | B案: APIレイヤーだけ統一、テーブルは各BCが所有。必要になったらA案（汎用テーブル統合）に移行 |
| S3キーカラム命名 | `key` に統一 |
| S3キーの値 | フルパス（バケット名は環境変数で管理） |
| 処理ステータス | 各BCのテーブルに残す。Storageはファイルの存在管理のみ、処理状態は各BCの責務 |
| ActiveStorage | 移行しない。デッドテーブルを削除 |

## data_source_files テーブル（分析時に追加発見）

| 項目 | 内容 |
|------|------|
| 用途 | データソースファイル管理 |
| ファイル関連カラム | `key`（S3キー）, `parsed_doc_key`（パース済S3キー）, `file_type`, `file_size`, `ai_status` |
| S3パターン | `datasource/{company_id}/{timestamp}/{filename}` |
| FK | `company_id` → companies, `folder_id`（任意） |
| 設計評価 | request_documentsと処理ステータスのenum（pending/processing/completed/failed）が重複実装 |
| BC帰属 | Datasourceパック |

## Storageパック設計

### パック内部構造

```
packs/storage/
  package.yml
  app/
    public/
      storage/api.rb              # 公開API（各BCはこれだけ参照）
    services/storage/
      s3_client.rb                # AWS SDK薄ラッパー（presigned URL、get/put/delete）
      cloudfront_client.rb        # CloudFront署名URL（動画HLS用）
      uploader.rb                 # アップロード処理（現DocumentsUploaderを移動）
  spec/
```

テーブルは持たない（B案）。純粋にサービス層だけのパック。

### 公開API

```ruby
Storage::Api.upload(file, path)        # S3へアップロード
Storage::Api.presigned_url(key)        # ダウンロードURL生成（有効期限付き）
Storage::Api.delete(key)               # S3オブジェクト削除
Storage::Api.metadata(key)             # content_type, size等のメタデータ取得
```

既存の`S3Service`、`CloudfrontService`、`DocumentsUploader`をStorageパックに移動し、public APIでラップする。各BCはこのAPIだけ使い、S3やCloudFrontを直接扱っていることは隠蔽される。

### S3ライフサイクル管理

各BCがモデルの`after_destroy`で`Storage::Api.delete(key)`を呼ぶ責務を持つ。Storage側はAPIを提供するだけ。

## 決定済みの対応事項

| 項目 | 対応方針 |
|------|---------|
| message_files | テーブル廃止（レコード未使用のため） |
| S3ライフサイクル管理 | 各BCが`after_destroy`で`Storage::Api.delete(key)`を呼ぶ |
| requests.chart_path | デッドカラム削除 |
| ActiveStorageデッドテーブル | 削除 |

## 未決事項

- [ ] manualsの動画ファイル設計の見直し（Manualパック化時に判断）
  - input_video_key/hls_video_keyはエンコード派生ファイルのキーでありvideo_idとは別物
  - video_id → request_documentsへのFKだが、request_documentsはPDFも動画も混在
  - エンコード派生キーの置き場所（manuals vs request_documents）も含めて再設計

---

## 関連ドキュメント

- [実装計画](./06-implementation-plan.md)
- [アーキテクチャ設計](./01-architecture-design.md)
