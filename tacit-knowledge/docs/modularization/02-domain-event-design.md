# Domain Event・Contracts 設計

## Domain Event 実装パターン

```ruby
# イベント発行
module Hearing
  module Events
    class HearingCompleted < SkillrelayCore::DomainEvent
      attribute :request_id, Integer
      attribute :room_id, Integer
    end
  end
end

# イベント購読（別パック）
module QaGeneration
  class HearingCompletedSubscriber
    def call(event)
      QaGenerationJob.perform_later(request_id: event.request_id)
    end
  end
end
```

---

## Domain Event 一覧

### Hearing → Worker（SQS経由・非同期）

| イベント | トリガー | 後続処理 |
|---------|---------|---------|
| `Hearing::Events::RequestCreated` | request作成時 | plan_generation |
| `Hearing::Events::RequestUpdated` | datasource追加時 | plan_generation |
| `Hearing::Events::HearingFinished` | ヒアリング完了時 | qa_generation → cross_user_conflict |
| `Hearing::Events::RehearingRequested` | 再ヒアリング時 | plan_generation |

### Manual → Worker（SQS経由・非同期）

| イベント | トリガー | 後続処理 |
|---------|---------|---------|
| `Manual::Events::ManualCreated` | マニュアル作成時 | manual_generation |
| `Manual::Events::VideoUploaded` | 動画アップロード時 | video_encoding + chapter生成 |

### Datasource → Worker（SQS経由・非同期）

| イベント | トリガー | 後続処理 |
|---------|---------|---------|
| `Datasource::Events::FileUploaded` | ファイルアップロード時 | indexing |

### Hearing → Platform（同期・ActiveSupport::Notifications）

| イベント | トリガー | 後続処理 |
|---------|---------|---------|
| `Hearing::Events::RequestStatusChanged` | requestのstatus変更時 | topic.update_status |

### Hearing ↔ Chat（同期・ActiveSupport::Notifications）

| イベント | トリガー | 後続処理 |
|---------|---------|---------|
| `Hearing::Events::HearingStarted` | ヒアリング開始時 | Room作成 |
| `Hearing::Events::HearingFinished` | ヒアリング完了時 | Room.is_finished = true |

---

## Contracts（Anti-Corruption Layer）設計

public APIの戻り値にActiveRecordオブジェクトを返さない。代わりに値オブジェクト（Result）を返す。

```ruby
# packs/datasource/app/public/datasource/api.rb
module Datasource
  class Api
    def self.find_file(file_id)
      file = DataSourceFile.find(file_id)
      Datasource::Result::File.new(id: file.id, key: file.key, status: file.ai_status)
    end
  end
end

# packs/datasource/app/public/datasource/result/file.rb
module Datasource
  module Result
    File = Data.define(:id, :key, :status)
  end
end
```

**ルール:**
- 全パックのpublic APIはActiveRecordオブジェクトを返さない
- 戻り値は `Data.define` 等の値オブジェクト（Result）を使う
- 内部テーブル構造の変更が公開インターフェースに漏れない

---

## 中間テーブルの所属

| テーブル | 所属 | 理由 |
|---------|------|------|
| `request_data_source_links` | Hearingパック | 参照する側（Hearing）が所有。Datasource側のpublic APIでファイル情報を取得 |
| `topic_data_source_links` | Platformパック | 同上。参照する側が所有 |

---

## 関連ドキュメント

- [アーキテクチャ設計](./01-architecture-design.md)
- [実装計画](./06-implementation-plan.md)
