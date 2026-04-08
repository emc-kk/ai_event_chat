require "test_helper"

class RequestTest < ActiveSupport::TestCase
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

  # === update_status_topic テスト ===

  test "update_status_topic: ステータス変更時にトピックのステータスが更新される" do
    request = Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :inhearing,
      request_type: :hearing
    )
    # inhearing のリクエストがあるので in_progress
    assert_equal "in_progress", @topic.reload.status

    request.update!(status: :completed)
    assert_equal "completed", @topic.reload.status
  end

  # === has_pending_conflicts? テスト ===

  test "has_pending_conflicts?: 未解決コンフリクトがなければfalse" do
    request = Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :not_started,
      request_type: :hearing
    )
    assert_not request.has_pending_conflicts?
  end

  test "has_pending_conflicts?: 未解決コンフリクトがあればtrue" do
    req_a = Request.create!(topic: @topic, created_by: @admin, status: :completed, request_type: :hearing)
    req_b = Request.create!(topic: @topic, created_by: @admin, status: :completed, request_type: :hearing)
    CrossUserConflict.create!(
      topic: @topic,
      request_a: req_a,
      request_b: req_b,
      question_a: "Q1", answer_a: "A1",
      question_b: "Q2", answer_b: "A2",
      similarity: 0.9,
      status: "pending"
    )
    assert req_a.has_pending_conflicts?
    assert req_b.has_pending_conflicts?
  end

  # === self.recover_stuck_updating テスト ===

  test "recover_stuck_updating: updatingのまま一定時間経過したリクエストを復旧する" do
    request = Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :updating,
      request_type: :hearing
    )
    request.update_column(:updated_at, 10.minutes.ago)

    Request.recover_stuck_updating(timeout: 5.minutes)
    assert_equal "not_started", request.reload.status
  end

  test "recover_stuck_updating: hearingルームがあればcompletedに復旧" do
    request = Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :updating,
      request_type: :hearing
    )
    Room.create!(
      request: request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: false
    )
    request.update_column(:updated_at, 10.minutes.ago)

    Request.recover_stuck_updating(timeout: 5.minutes)
    assert_equal "completed", request.reload.status
  end

  test "recover_stuck_updating: タイムアウト前なら復旧しない" do
    Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :updating,
      request_type: :hearing
    )
    count = Request.recover_stuck_updating(timeout: 5.minutes)
    assert_equal 0, count
  end
end
