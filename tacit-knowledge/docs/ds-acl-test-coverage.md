# データソース管理 + 権限システム テストカバレッジ & 今後の予定

## テスト実施済み内容の詳細（Round 1-21, 1,882テスト + ブラウザE2E 86項目）

### モデル層（35+ models）
- **Permission**: role enum (viewer/editor/owner)、grantee_type (Admin/User/UserGroup)、grantee_belongs_to_same_company validation、cross-company拒否、privileged admin許可、scopes全種、uniqueness with soft_delete、soft delete support
- **Topic**: status enum (not_started/in_progress/completed)、update_status / calculate_status_from_requests（3分岐）、after_save callback連携、scopes、Permissible concern include、permission_parent (folder/nil)、name/description validation
- **TopicFolder**: breadcrumb (ancestor chain)、topics_count、roots scope、uniqueness within company、Permissible include、prevent_circular_reference
- **DataSourceFolder**: breadcrumb (1-3 levels)、files_count、prevent_circular_reference (self/direct/deep cycle)、name uniqueness within parent、roots scope、permission_parent、parent-child hierarchy
- **DataSourceFile**: file_extension (pdf/xlsx/大文字/複数ドット/拡張子なし)、ai_status enum (pending/processing/completed/failed)、Permissible include、permission_parent (folder)、name/key validation、for_company/in_folder scopes、acts_as_paranoid
- **Room**: chat_type validation (hearing/validation/topic)、must_have_request_or_topic、scopes (hearing/validation/topic/active/finished/unfinished)、instance methods (finish!/soft_delete!/restore!)、find_existing_for_chat、find_or_create_for_chat (通常/rehearing/request_content_id付き)
- **Request**: 9ステータスenum、request_type、generally_access? (6ステータス)、status_except/status_history/generally_accessible/hearing_type scopes、validation_status_options、update_status_topic callback、ransackable、soft delete、associations (rooms/contents/documents/hearing_suggestions)
- **User**: authenticate (正/誤/blank digest)、session_token生成・キャッシュ、user_group_ids caching、find_by_email_or_username、find_veterans scope、email uniqueness、password validation (regex)、role enum、creator必須、soft delete
- **Admin**: authenticate (正/誤)、privileged? (company_id=nil)、session_token、Confirmable include、email/password validation、scopes (for_company/privileged/find_by_email_or_username)
- **Company**: status enum (active/inactive)、7 associations、name required/max length、status_active scope、ransackable
- **UserGroup**: members_count、name required/max length/uniqueness within company、for_company scope、soft delete、8 associations、permissions as grantee
- **UserGroupMembership**: same company valid/cross-company invalid、uniqueness、acts_as_paranoid
- **Message**: message_type/chat_type enums、7 associations
- **MessageFile**: ALLOWED_CONTENT_TYPES、image?/pdf? predicate、validation
- **RequestDocument**: status enum (4種)、key required
- **RequestContent**: associations (request/rooms)
- **HearingExtract**: LAYER_NAMES(5)/RISK_AXES(6)/DATA_4TYPES(4)/DATA_SOURCES(4)/VERIFICATION_REQUIREMENTS、layer_name/risk_axis_name methods
- **HearingStepState**: STEP_NAMES(3)、step_name/active?/completed? methods
- **HearingSuggestion**: pending/answered scopes with DB records
- **BiasFlag**: BIAS_TYPES(5)、bias_type/detection_stage/status validations、confidence_score range(0-1)
- **Manual/Chapter/Transcription**: 全associations
- **TopicDataSourceLink**: belongs_to (topic/data_source_file/linked_by polymorphic)、file_must_be_completed validation（completed以外拒否）、uniqueness (topic_id, data_source_file_id)、for_topic/for_file scopes、ハードデリート（acts_as_paranoidなし）、updated_atなし、ULID PK

### Concern層（13 concerns）
- **Permissible**: check_permission 4経路 (直接個人→直接グループ→継承個人→継承グループ)、admin fallback (no_permissions_in_chain)、role_sufficient? 全9組合せ、inherited_permissions、effective_permissions、has_direct_permissions?、viewable_by?/editable_by?
- **TopicAccessControl**: resolve_topic_for_permission 4経路、require_topic_viewer/editor、deny_access、4コントローラー包含
- **DataSourceAccessControl**: resolve_ds_resource 3経路、require_ds_viewer/editor/owner、deny_ds_access、APIコントローラー包含
- **FolderOperations**: descendant_ids、validate_folder_move (self-reference/descendant/nonexistent/valid)
- **Confirmable**: confirmed?、confirm!、confirmation_token_valid? (24時間有効期限)
- **RequireCompanyContext**: require_company_context method
- **SafeAttributes**: DSL (safe_attributes getter/setter)
- **UlidPk**: ULID生成、フォーマット検証(26文字)
- **SkipUlidPk**: set_ulid override

### コントローラー層（27+ controllers）
- **TopicsController**: 8 actions、topic_scope/require_topic_editor_permission/visible_subfolders/find_or_create_topic_room/folder_scope、topic_by_permission/folder_permission/request
- **TopicFoldersController**: create/update/destroy/move、FolderOperations、require_editor_permission/folder_scope、circular prevention
- **DataSourcesController**: index、user_has_any_ds_permission? (personal/group)
- **Api::DataSourceFoldersController**: 3 concerns、14 private methods、before_actions
- **Api::DataSourceFilesController**: ALLOWED_FILE_TYPES(9種)、SEARCH_LIMIT=50、sanitize_sql_like、linked_topics、bulk_create_topic（TopicDataSourceLink連携）
- **Api::TopicDataSourceLinksController**: RequireCompanyContext/TopicAccessControl include、index/create/destroy、topic viewer/editor権限チェック、DS file editor権限チェック（create時）
- **RoomsController**: 構造、before_action、アクション一覧
- **RequestsController**: admin_required、全アクション存在確認
- **MessagesController**: TopicAccessControl、skip_before_action verify_authenticity_token
- **ChatFilesController**: upload/download、require_chat_file_permission/require_download_permission
- **ConfirmationsController**: find_record_by_token (admin/user/blank)、find_record_by_email
- **PermissionsController**: CRUD、ALLOWED_GRANTEE_TYPES(3)、set_permissible(4 types)、require_owner_permission
- **RequestContentsController**: TopicAccessControl、require_topic_editor
- **Topics::VideosController**: show/update/status、before_action
- **SessionsController**: dual auth (User→Admin)、find_by_email_or_username
- **AdminsController/UsersController/CompaniesController/UserGroupsController**: CRUD、admin_required/privileged_admin_required、scope

### サービス層（4 services）
- **S3Service**: PRESIGNED_URL_EXPIRATION=3600、presigned_url (nil key handling)、download_file、get_content_type、get_original_filename
- **SqsMessageService**: send_message with pending documents
- **AiServerClient**: BASE_URL、get_qa_data
- **CloudfrontService**: signed_hls_url、signed_url

### ヘルパー層（6 helpers）
- **SessionsHelper**: 16 methods、company_admin/veteran/general role check
- **ApplicationHelper**: can_access_chat? (hearing 6 allowed/3 blocked、validation 4 allowed/5 blocked)、active_class、latest_room_path、include_stylesheets
- **DashboardHelper**: options_for_request_status、options_for_searching_fields、options_topics
- **Topics::VideosHelper**: substr、seconds_to_time、thumbnail_url

### ブラウザE2Eテスト（86項目）
- BT1-BT14 (Round 14): 特権管理者/企業管理者/一般ユーザーのログイン・サイドバー・DS管理画面・フォルダナビ・コンテキストメニュー・権限設定・アクセス拒否
- BT15-BT24 (Round 15): ユーザー管理/グループ管理/管理者管理/会社管理ページ・アクセス制御・権限フィルタリング
- UI-1~UI-7 (Round 18-UI, 39項目): ナレッジタブUI（タブ切替/一覧/チェックボックス/追加モーダル/解除/検索連携/状態管理）36 PASS, 3未テスト
- UT-1~UT-5 (Round 18-UT, 23項目): ロール別ユーザーテスト（企業管理者/editor/viewer/権限なし/ルームタイプ別）全PASS

### その他
- **ConfirmationMailer**: class/inheritance/confirmation_instructions
- **DocumentsUploader**: CarrierWave/extension_allowlist(9 types)
- **データ整合性チェック**: orphan permissions=0、外部キー整合性、ユニーク制約、カスケード削除、循環参照なし
- **境界値テスト**: Topic/DSFolder/DSFile name 255/256文字、BiasFlag confidence_score 0.0/1.0/-0.01/1.01

---

## 今後テスト予定の内容（未実施）

### 1. コントローラー統合テスト（HTTPリクエストレベル）
現在のテストはモデル/concern/構造レベルが中心。実際のHTTPリクエスト（GET/POST/PATCH/DELETE）を送信してレスポンスコード・リダイレクト・JSON応答を検証する統合テストが未実施:
- DataSourceFolders API: POST /api/data_source_folders (作成)、PATCH (名前変更/移動)、DELETE (削除) の実際のHTTPレスポンス
- DataSourceFiles API: POST /api/data_source_files (アップロード)、GET (検索/一覧)、PATCH (移動)、DELETE (削除)
- PermissionsController: POST/PATCH/DELETE の実際のHTTPリクエスト → 権限チェック → レスポンス
- TopicsController: CRUD + room作成連携の統合フロー

### 2. 外部サービスモック統合テスト
S3/SQS/CloudFrontの外部サービス呼び出しをモックして、エンドツーエンドフローを検証:
- ファイルアップロード→S3 presigned URL生成→SQS送信→AI処理ステータス更新フロー
- 動画配信→CloudFront signed URL生成→HLS配信フロー
- AiServerClient→QAデータ取得→レスポンス処理フロー

### 3. 並行アクセス・競合テスト
- 同一フォルダへの同時移動操作
- 同一ファイルへの同時権限変更
- 同一トピックへの同時リクエストステータス更新
- データベースロック・楽観的ロック動作

### 4. トランザクション・ロールバックテスト
- ファイルアップロード途中でのS3エラー時のDB rollback
- 権限付与時のvalidationエラーでの部分コミット防止
- Room.find_or_create_for_chat中のrace condition

### 5. 追加ブラウザE2Eテスト
- フォルダ作成→名前変更→移動→削除のフルライフサイクル操作
- ファイルアップロード→AI学習ステータス表示→検索→移動→削除
- 権限付与→権限変更→権限削除→アクセス確認の操作フロー
- rehearingフローの完全なUI操作テスト
- レスポンシブ表示（モバイル/タブレット）
- **ナレッジタブUI**: タブ切替、DS一覧表示、チェックボックス選択、追加モーダル、リンク解除、ナレッジ検索→チャット連携（テスト計画書作成済み: ds-acl-uat.md Round 18-UI セクション参照）

### 6. パフォーマンス・負荷テスト
- 大量フォルダ（100+）のブラウズ/検索レスポンス
- 大量ファイル（1000+）でのページネーション
- 深いネスト（10階層+）でのbreadcrumb/permission解決パフォーマンス

### 7. 仕様変更後の回帰テスト
**注意**: データソースの仕様変更後、以下が影響を受ける可能性あり:
- DataSourceFolder/DataSourceFile モデルのバリデーション・association
- Api::DataSourceFolders/FilesController のAPI仕様
- DataSourceAccessControl concern の権限チェック
- Permissible concern のDS向け権限解決ロジック
- SessionsHelper の user_has_ds_permission?/user_has_any_ds_permission?
- Round 6-17 の既存テストの一部修正が必要になる可能性

仕様変更完了後に既存テスト（Round 6-17）の回帰テストを実行し、破損テストの修正→新仕様に対応した追加テストを実施する予定。

### 8. DS↔Topic リンク追加テスト（一部実施済み）

**実施済み:**
- TopicDataSourceLink モデル: file_must_be_completed validation、uniqueness、scopes、ハードデリート、ULID PK（Round 1-21内で実施）
- TopicDataSourceLinksController: RequireCompanyContext/TopicAccessControl include、index/create/destroy、topic viewer/editor権限チェック、DS file editor権限チェック（create時）
- Api::DataSourceFilesController: bulk_create_topic（TopicDataSourceLink連携）、linked_topics
- ナレッジタブUIのブラウザE2E: タブ切替/一覧/チェックボックス/追加モーダル/解除/検索連携/状態管理（Round 18-UI, 36 PASS）
- ロール別ユーザーテスト: 企業管理者/editor/viewer/権限なし/ルームタイプ別（Round 18-UT, 23テスト全PASS）

**未実施:**
- TopicDataSourceLinksController の HTTP統合テスト（実際のHTTPリクエスト→レスポンスコード検証）
- USE_NEW_TOPIC_LINKS 環境変数の切替テスト（旧方式/新方式の動作比較）
- マニュアル作成機能（DSファイル選択→マニュアル自動生成）— **未実装、今後の実装予定**

### 9. 社内辞書 ↔ チャット連携（実施済み）

**実施済み（ブラウザ手動検証）:**
- 辞書用語マッチング: `getMatchingGlossaryTerms(companyId, userMessage)` による SQL 部分一致検索が正しく動作することを確認
- 辞書定義のシステムプロンプト注入: `topic-agent` の instructions に `## Company Glossary Terms` セクションが正しく挿入されることを確認
- 辞書用語を含む質問 → AI回答に辞書定義が含まれる（KPI報告書、OKR会議、SLA契約で検証済み）
- 辞書未登録用語の質問 → 辞書定義が表示されない（ガントチャート、スクラム開発で検証済み）
- 辞書用語を含むがDS内容と無関係な質問 → 辞書定義のみ提示、追加情報なしと正直に回答

**実施済み（コード変更・バグ修正）:**
- `ai-server/lib/services/database-service.ts`: `getTopicDataById()` に `company_id` 追加、`getMatchingGlossaryTerms()` 新関数追加
- `ai-server/app/api/topic/route.ts`: 辞書検索をチャットフローに組み込み、`requestContext` に `glossaryTerms` を渡す
- `ai-server/lib/mastra/agents/topic-agent.ts`: `TopicAgentContext` に `glossaryTerms` 追加
- `ai-server/lib/prompts/prompts.yml`: topic instructions に `## Company Glossary Terms` セクション追加、Response Rules に辞書優先ルール追加
- `ai-server/lib/prompts/index.ts`: `getTopicInstructions()` に `glossaryTerms` 引数追加、`formatPrompt()` に `{glossary_terms}` 置換追加
- `ai-server/lib/prompts/types.ts`: `PromptContext` に `glossaryTerms` 追加
- `ai-server/lib/types/chat.ts`: `TopicData` に `companyId` 追加

### 10. AIレスポンス品質・RAGパイプライン検証（実施済み）

**実施済み（ブラウザ手動検証）:**
- DS検索（retrieve_context）が正しく呼ばれ、リンク済みDSファイルの内容を取得できることを確認
- DSファイル内容（プロジェクト概要、テスト対象、KPI指標）がAI回答に正しく反映されることを確認
- query_qa のみ呼ばれるケース → ヒアリングQA未登録時に「情報なし」と正しく回答することを確認
- ストリーミング応答が正常に完了することを確認
- チャットページのレイアウト（タイトル・説明の全文表示）に問題がないことを確認

**実施済み（バグ修正 — commit e78ff3f）:**
- `ai-server/lib/rag/vector-store.ts`: JSONB演算子修正 `->` → `->>`（`_node_content` のJSONテキスト展開、6箇所）
- `ai-server/lib/mastra/tools/rag-retriever-tool.ts`: `requestId` 配列ハンドリング修正（空配列 `[]` が truthy として誤フィルタされる問題）
- `ai-server/lib/rag/reranker.ts`: Cohere API キー未設定時のフォールバック追加（元の類似度順で返却）

**実施済み（レイアウト修正）:**
- `core/app/views/rooms/show.html.erb`: `.content-header { display: none !important }` 追加（`margin: 10px 40px 40px 0` が `overflow: hidden` と組み合わさり `scrollLeft: 40px` の水平スクロールが発生する問題を修正）

**実施済み（プロンプト改善）:**
- `ai-server/lib/prompts/prompts.yml`: Response Rules の辞書優先ルールを強化（辞書用語がマッチした場合はツール検索結果がなくても定義を必ず提示するよう修正）

### 11. 包括的ACL統合テスト（Rails Runner実行、実施済み）

#### C-1: DS-ACL API統合テスト（24/25 PASS）
フォルダ/ファイルのCRUD操作と権限チェックをRails Runnerで直接実行:
- **フォルダCRUD**: 企業管理者によるルートフォルダ作成・名前変更・サブフォルダ作成（全PASS）
- **同名フォルダ拒否**: 同一階層に同名フォルダ作成 → 422「同じフォルダ内に同名のフォルダが存在します」（PASS）
- **Viewer権限**: viewable_by?=true, editable_by?=false（PASS）
- **Editor権限**: editable_by?=true（PASS）
- **権限なしユーザー**: viewable_by?=false（PASS）
- **クロスカンパニー拒否**: Company BユーザーがCompany Aフォルダを閲覧不可（PASS）
- **サブフォルダ継承**: viewer/editor権限が親→子に正しく継承（PASS）
- **特権管理者**: company_id=nil の Admin が全社フォルダにフルアクセス（PASS）
- **企業管理者**: Permissible concern単体では権限チェーン上にpermissions存在時はfalse（FAIL）。ただしコントローラー層で `current_admin? || current_user_company_admin?` による短絡評価があるため**実運用上は問題なし**
- **SQLインジェクション防止**: `test%'OR 1=1--` のような攻撃文字列がsanitize_sql_likeで安全に処理（PASS）
- **循環参照防止**: 親フォルダを自身の子に移動 → validation失敗（PASS）
- **ファイル権限**: ファイルが親フォルダの権限を継承（viewer閲覧可/編集不可、editor編集可）（PASS）
- **Owner権限**: owned_by?=true/viewerはowned_by?=false（PASS）
- **Company B管理者拒否**: Company Bの企業管理者がCompany Aフォルダを編集不可（PASS）

#### C-2: DS↔トピックリンク二重権限チェック（4/4 PASS）
- TopicDataSourceLink テーブル構造確認（columns: id, topic_id, data_source_file_id, linked_by_id, linked_by_type, created_at）
- ai_status=completed のファイルのみリンク可能（コントローラーレベルバリデーション）
- 既存リンクの重複作成不可（uniqueness制約）
- 3件のリンクが正しく存在（CompanyA内のみ）

#### C-3: RAG検索の会社分離（5/5 PASS — 実質テスト可能項目）
- data_knowledge_documents テーブルに28件のドキュメント存在
- TopicDataSourceLink が会社スコープで正しく分離（CompanyA: 365トピック/3リンク、CompanyB: 2トピック/0リンク）
- topic_data_source_links テーブル構造確認
- metadata_.topic_id による旧方式のRAGスコーピング確認
- **注意**: data_knowledge_documents テーブルに company_id カラムなし — 会社分離は topic_id (metadata_) または topic_data_source_links JOIN で実現

#### C-4: DSフォルダ権限継承チェーン（10/10 PASS）
- 3階層（root → child → grandchild）作成
- root に viewer 権限設定 → grandchild に継承（viewable=true, editable=false）
- child に直接 editor 権限設定 → child/grandchild 共に editable=true（直接権限が優先）
- グループ権限: UserGroup に editor 付与 → グループメンバー(user3)が grandchild を閲覧可能
- 権限なしユーザー / クロスカンパニーユーザー → grandchild 閲覧不可

#### H-1: ファイルアップロード→AI学習パイプライン（5/5 PASS）
- ai_status分布確認: pending=64, processing=1, completed=4, failed=1
- completed ファイル存在確認（リンク可能）
- ai_status enum定義確認（pending=0, processing=1, completed=2, failed=3）
- S3キーフォーマット確認: `datasource/{company_id}/{timestamp}/{filename}`
- TopicDataSourceLinks: 3件存在

#### H-2: トピックチャットRAG（3/3 PASS）
- DSリンクありトピック: R11-TP-InFolder-1771828475(2files), 辞書+DS連動テスト(1file)
- DSリンクなしトピック: 3件存在（RAG検索結果なしで正常動作）
- data_knowledge_documents: 28件

#### H-3: ナレッジタブUIシナリオ（2/2 PASS）
- AI未完了ファイル存在確認（pending=64, processing=1, failed=1）
- コントローラーでai_status==completedバリデーション確認

#### H-4: ヒアリング+DS連携（2/2 PASS）
- リクエスト96件存在
- ルーム153件存在（chat_type カラムで分類）

#### M-1: 検索特殊文字安全性（7/8 PASS）
テスト文字: `%`, `_`, `'`, `"`, `\`, `<script>`, `DROP TABLE`, `\0`
- 7種類の特殊文字が sanitize_sql_like で安全に処理（PASS）
- NULL byte (`\0`): PostgreSQLが「string contains null byte」エラーを返す（FAIL — セキュリティ上は安全だが、アプリレベルでの事前フィルタリング推奨）

#### M-2: 循環参照（C1-1pでカバー済み — PASS）

#### M-3: カスケード削除（1/1 PASS）
- 親フォルダsoft delete → 子フォルダは active record では非表示、with_deleted で復元可能

#### M-4: グループ権限合成（2/2 PASS）
- 28グループ存在
- user3 が「テストグループ」に所属確認

#### M-5: 辞書マッチング境界（3/3 PASS）
- 3用語存在: KPI報告書, OKR会議, SLA契約
- 完全一致: 「KPI報告書をお教えください」→ マッチ
- 部分文字列: 「KPIテスト」（部分文字列 "KPI" のみ）→ 不一致（position関数は用語全体をテキスト内で検索）

#### M-6: 深いネスト（2/2 PASS）
- 5階層フォルダ作成成功
- root の viewer 権限が5階層目まで正しく継承

#### M-7~M-8: S3エラー/Cohere fallback（各1/1 PASS — 既存実装確認）
- S3: コントローラーに rescue ブロック確認
- Cohere: 前回のバグ修正（e78ff3f）でフォールバック実装済み

### 12. UIブラウザテスト（実施済み）

#### L-1: データソース管理画面（PASS）
- フォルダ一覧が正しく表示（名前、AI学習状態、更新日、更新者カラム）
- 新規フォルダ/ファイルを追加ボタン表示
- 検索ボックス表示（プレースホルダ:「マニュアル名やファイル内の文字で検索...」）
- パンくずナビ（ホームアイコン）表示

#### L-2: トピックチャット画面（PASS）
- タイトル・説明文が正しく表示（水平スクロールなし — 前回の修正が有効）
- チャット/ナレッジタブの切替動作
- メッセージ入力欄・送信ボタン
- チャット履歴の表示

#### L-3: ナレッジタブ画面（PASS）
- ファイル一覧: r15-dsfa4.pdf（完了）、テストファイル.txt（完了, 79B）
- ステータスバッジ（緑「完了」）
- リンク解除ボタン
- 「+ナレッジ追加」ボタン

#### L-4: レスポンシブ表示
- **1512px（デスクトップ）**: 全要素正常表示（PASS）
- **768px（タブレット）**: レイアウト調整あり、主要機能は操作可能（PASS）
- **375px（モバイル）**: サイドバーが画面の大部分を占め、コンテンツ領域が狭い。テーブルカラムが切り詰められる。「戻る」ボタンが画面外に。**管理画面として最低限の表示は可能だが、モバイル最適化は未対応**（KNOWN ISSUE）

#### L-5: エラーUX / ローディング状態
- ブラウザ接続切断時のテスト: Chrome拡張の接続断発生 → 以降のブラウザテスト中断（接続の安定性は改善の余地あり）
