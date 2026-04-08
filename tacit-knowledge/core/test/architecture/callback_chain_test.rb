# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: BC間のcallback連鎖・モデル間連携が正常に動作することを確認。
# after_save等で他BCのモデルを直接触っている処理の動作確認。
#
# カバーするBC間連携:
#   - Request#after_save → Topic#update_status（status変更時）
#   - Room ↔ Request（チャット開始/終了の状態連携）
#   - ComparisonSession → Topic#chat_accessible?（比較結果の状態影響）
#   - Permission → Permissible（権限チェーンの継承）
#   - CrossUserConflict ↔ Request（コンフリクト判定）
#   - Confirmable concern（Admin/User作成時のtoken付与）
#
# 実行方法:
#   bundle exec rails test test/architecture/callback_chain_test.rb
#
class CallbackChainTest < ActiveSupport::TestCase
  # --- Request → Topic callback連鎖テスト ---

  test "Request status change triggers Topic#update_status" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(
      name: "callback test topic",
      description: "test description",
      company: company,
      created_by: admin
    )

    request = Request.create!(
      topic: topic,
      created_by: admin,
      status: :not_started,
      request_type: :hearing
    )

    # status変更でcallbackが発火し、Topic#update_statusが呼ばれる
    request.update!(status: :inhearing)
    assert_equal "in_progress", topic.reload.status

    request.update!(status: :completed)
    assert_equal "completed", topic.reload.status
  end

  test "Topic status becomes not_started when all requests are absent" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(
      name: "empty topic",
      description: "no requests",
      company: company,
      created_by: admin
    )

    assert_equal "not_started", topic.reload.status
  end

  test "Topic status becomes in_progress when any request is not completed" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(
      name: "mixed status topic",
      description: "test",
      company: company,
      created_by: admin
    )

    req1 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req2 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    # 1つだけcompletedにしてもin_progressのまま
    req2.update!(status: :completed)
    assert_equal "in_progress", topic.reload.status
  end

  test "Topic status becomes completed when all requests are completed" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(
      name: "all completed topic",
      description: "test",
      company: company,
      created_by: admin
    )

    req1 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    req1.update!(status: :completed)
    # 単一requestが全てcompleted → topicもcompleted
    assert_equal "completed", topic.reload.status
  end

  # --- Room ↔ Request 連携テスト ---

  test "Room.find_or_create_for_chat creates hearing room linked to request and topic" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "room test topic", description: "test", company: company, created_by: admin)
    request = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    room = Room.find_or_create_for_chat(request, "hearing")

    assert room.persisted?
    assert_equal request.id, room.request_id
    assert_equal topic.id, room.topic_id
    assert_equal "hearing", room.chat_type
  end

  test "Room.find_or_create_for_chat returns existing room on second call" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "room reuse topic", description: "test", company: company, created_by: admin)
    request = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    room1 = Room.find_or_create_for_chat(request, "hearing")
    room2 = Room.find_or_create_for_chat(request, "hearing")

    assert_equal room1.id, room2.id, "同じrequestへの2回目の呼び出しは既存roomを返すべき"
  end

  test "Room.find_or_create_for_chat creates new room for rehearing status" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "rehearing topic", description: "test", company: company, created_by: admin)
    request = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    room1 = Room.find_or_create_for_chat(request, "hearing")
    room1.send(:finish!)

    # rehearing状態にすると新しいroomが作られる
    request.update_column(:status, Request.statuses[:rehearing])
    request.reload

    room2 = Room.find_or_create_for_chat(request, "hearing")
    refute_equal room1.id, room2.id, "rehearing時は新しいroomが作られるべき"
  end

  test "Room.find_or_create_for_chat creates topic chat room linked to topic" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "topic chat", description: "test", company: company, created_by: admin)

    room = Room.find_or_create_for_chat(topic, "topic")

    assert room.persisted?
    assert_equal topic.id, room.topic_id
    assert_nil room.request_id
    assert_equal "topic", room.chat_type
  end

  # --- ComparisonSession → Topic#chat_accessible? 連携テスト ---

  test "Topic#chat_accessible? returns true when completed and no comparison sessions" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "accessible topic", description: "test", company: company, created_by: admin)
    request = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    request.update!(status: :completed)

    assert topic.reload.chat_accessible?, "全request完了 + comparison_sessionなし → アクセス可"
  end

  test "Topic#chat_accessible? returns false when not completed" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "not accessible topic", description: "test", company: company, created_by: admin)
    Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    refute topic.reload.chat_accessible?, "未完了のtopic → アクセス不可"
  end

  test "Topic#chat_accessible? returns false when comparison session is not completed" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "comparison topic", description: "test", company: company, created_by: admin)
    req1 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req2 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req1.update!(status: :completed)
    req2.update!(status: :completed)

    ComparisonSession.create!(
      topic: topic,
      created_by: admin,
      request_ids: [req1.id, req2.id],
      status: :analyzing
    )

    refute topic.reload.chat_accessible?, "comparison_sessionが未完了 → アクセス不可"
  end

  test "Topic#chat_accessible? returns true when all comparison sessions completed" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "all completed comparison", description: "test", company: company, created_by: admin)
    req1 = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req1.update!(status: :completed)

    ComparisonSession.create!(
      topic: topic,
      created_by: admin,
      request_ids: [req1.id],
      status: :completed
    )

    assert topic.reload.chat_accessible?, "全comparison_session完了 → アクセス可"
  end

  # --- CrossUserConflict ↔ Request 連携テスト ---

  test "Request#has_pending_conflicts? detects cross-user conflicts" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "conflict topic", description: "test", company: company, created_by: admin)
    req_a = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req_b = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    refute req_a.has_pending_conflicts?, "コンフリクトなし → false"

    CrossUserConflict.create!(
      topic: topic,
      request_a: req_a,
      request_b: req_b,
      question_a: "質問A",
      question_b: "質問B",
      answer_a: "回答A",
      answer_b: "回答B",
      similarity: 0.9,
      status: "pending"
    )

    assert req_a.has_pending_conflicts?, "pendingコンフリクトあり → true"
    assert req_b.has_pending_conflicts?, "req_bからも検出できる → true"
  end

  test "Request#has_pending_conflicts? ignores resolved conflicts" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)

    topic = Topic.create!(name: "resolved conflict topic", description: "test", company: company, created_by: admin)
    req_a = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)
    req_b = Request.create!(topic: topic, created_by: admin, status: :not_started, request_type: :hearing)

    CrossUserConflict.create!(
      topic: topic,
      request_a: req_a,
      request_b: req_b,
      question_a: "質問1",
      question_b: "質問2",
      answer_a: "回答1",
      answer_b: "回答2",
      similarity: 0.8,
      status: "resolved_a"
    )

    refute req_a.has_pending_conflicts?, "解決済みコンフリクトはpendingではない → false"
  end

  # --- Permission → Permissible 権限継承チェーンテスト ---

  test "TopicFolder permission is inherited by child Topic" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)
    user = users(:company_a_editor)

    folder = TopicFolder.create!(name: "perm test folder", company: company, created_by: admin)
    topic = Topic.create!(name: "perm test topic", description: "test", company: company, created_by: admin, folder: folder)

    # フォルダに権限設定 → トピックに継承される
    Permission.create!(
      company: company,
      permissible: folder,
      grantee_type: "User",
      grantee_id: user.id,
      role: :editor
    )

    assert topic.viewable_by?(user, "user"), "フォルダのeditor権限がトピックに継承される（viewer以上）"
    assert topic.editable_by?(user, "user"), "フォルダのeditor権限がトピックに継承される（editor以上）"
    refute topic.owned_by?(user, "user"), "editor権限ではownerにはならない"
  end

  test "Direct permission on Topic overrides inherited permission" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)
    user = users(:company_a_editor)

    folder = TopicFolder.create!(name: "override test folder", company: company, created_by: admin)
    topic = Topic.create!(name: "override test topic", description: "test", company: company, created_by: admin, folder: folder)

    # フォルダにviewer、トピックに直接editor → 直接権限が優先
    Permission.create!(company: company, permissible: folder, grantee_type: "User", grantee_id: user.id, role: :viewer)
    Permission.create!(company: company, permissible: topic, grantee_type: "User", grantee_id: user.id, role: :editor)

    assert topic.editable_by?(user, "user"), "直接権限(editor)が継承権限(viewer)より優先される"
  end

  test "DataSourceFolder permission chain: folder → child folder → file" do
    company = companies(:company_a)
    admin = admins(:company_a_admin)
    user = users(:company_a_viewer)

    parent_folder = DataSourceFolder.create!(name: "parent ds folder", company: company, created_by: admin)
    child_folder = DataSourceFolder.create!(name: "child ds folder", company: company, created_by: admin, parent: parent_folder)
    file = DataSourceFile.create!(name: "test.pdf", key: "ds/test.pdf", company: company, created_by: admin, folder: child_folder)

    # 親フォルダに権限設定 → 子フォルダ → ファイルに継承
    Permission.create!(company: company, permissible: parent_folder, grantee_type: "User", grantee_id: user.id, role: :viewer)

    assert file.viewable_by?(user, "user"), "親フォルダの権限が孫ファイルまで継承される"
  end

  test "Privileged admin has full access without explicit permission" do
    admin = admins(:privileged_admin)
    company = companies(:company_a)
    ca_admin = admins(:company_a_admin)

    folder = TopicFolder.create!(name: "priv admin test", company: company, created_by: ca_admin)

    assert folder.viewable_by?(admin, "admin"), "特権管理者は権限設定なしでもアクセス可"
    assert folder.editable_by?(admin, "admin"), "特権管理者は権限設定なしでも編集可"
    assert folder.owned_by?(admin, "admin"), "特権管理者は権限設定なしでもオーナー権限あり"
  end

  # --- Confirmable concern callback テスト ---

  test "Admin gets confirmation_token set on create" do
    admin = Admin.new(
      name: "new admin",
      email: "new_admin_callback_test@example.com",
      password: "Test1234!",
      company: companies(:company_a)
    )
    admin.save!
    assert admin.confirmation_token.present?, "Admin should get a confirmation_token on create"
  end

  test "User gets confirmation_token set on create" do
    user = User.new(
      name: "new user",
      email: "new_user_callback_test@example.com",
      password: "Test1234!",
      company: companies(:company_a),
      creator: admins(:company_a_admin),
      role: :general
    )
    user.save!
    assert user.confirmation_token.present?, "User should get a confirmation_token on create"
  end
end
