require "test_helper"

class TopicTest < ActiveSupport::TestCase
  setup do
    @company = companies(:company_a)
    @admin = admins(:company_a_admin)
    @topic = Topic.create!(
      name: "テストトピック",
      description: "テスト用",
      company: @company,
      created_by: @admin
    )
  end

  # === update_status テスト ===

  test "update_status: リクエストがなければnot_started" do
    @topic.update_status
    assert_equal "not_started", @topic.reload.status
  end

  test "update_status: 全リクエスト完了ならcompleted" do
    Request.create!(topic: @topic, created_by: @admin, status: :completed, request_type: :hearing)
    Request.create!(topic: @topic, created_by: @admin, status: :completed, request_type: :hearing)
    @topic.update_status
    assert_equal "completed", @topic.reload.status
  end

  test "update_status: 未完了リクエストがあればin_progress" do
    Request.create!(topic: @topic, created_by: @admin, status: :completed, request_type: :hearing)
    Request.create!(topic: @topic, created_by: @admin, status: :inhearing, request_type: :hearing)
    @topic.reload.update_status
    assert_equal "in_progress", @topic.reload.status
  end

  # === chat_accessible? テスト ===

  test "chat_accessible?: completedかつ比較セッションなしでtrue" do
    @topic.update_column(:status, Topic.statuses[:completed])
    assert @topic.chat_accessible?
  end

  test "chat_accessible?: not_startedならfalse" do
    @topic.update_column(:status, Topic.statuses[:not_started])
    assert_not @topic.chat_accessible?
  end

  test "chat_accessible?: completedだが未完了の比較セッションがあればfalse" do
    @topic.update_column(:status, Topic.statuses[:completed])
    ComparisonSession.create!(
      topic: @topic,
      request_ids: ["req1"],
      status: :analyzing,
      created_by: @admin
    )
    assert_not @topic.chat_accessible?
  end

  test "chat_accessible?: completedかつ全比較セッション完了ならtrue" do
    @topic.update_column(:status, Topic.statuses[:completed])
    ComparisonSession.create!(
      topic: @topic,
      request_ids: ["req1"],
      status: :completed,
      created_by: @admin
    )
    assert @topic.chat_accessible?
  end
end
