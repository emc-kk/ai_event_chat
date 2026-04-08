require "test_helper"

class SeedDataTest < ActiveSupport::TestCase
  # seed-fuを実行してDB状態を検証する
  # fixturesを使わずトランザクション内で実行（他テストとの干渉を防ぐ）

  fixtures []

  setup do
    SeedFu.seed(Rails.root.join("db", "fixtures", "development"))
  end

  test "seed creates companies" do
    assert Company.find_by(name: "株式会社サンプル")
    assert Company.find_by(name: "テスト株式会社")
  end

  test "seed creates privileged admin" do
    admin = Admin.find_by(email: "admin@example.com")
    assert admin
    assert_nil admin.company_id
  end

  test "seed creates users with all roles" do
    assert_equal "company_admin", User.find_by(email: "admin1@example.com").role
    assert_equal "veteran", User.find_by(email: "user1@example.com").role
    assert_equal "general", User.find_by(email: "user3@example.com").role
  end

  test "seed creates completed topic with chat_accessible?" do
    topic = Topic.find_by(name: "受注処理の手順")
    assert topic
    assert_equal "completed", topic.status
    assert topic.chat_accessible?
  end

  test "seed creates completed request" do
    topic = Topic.find_by(name: "受注処理の手順")
    request = topic.requests.find_by(name: "受注処理ヒアリング")
    assert request
    assert_equal "completed", request.status
    assert_equal "hearing", request.request_type
    assert request.respondent.present?
  end

  test "seed creates request content" do
    topic = Topic.find_by(name: "受注処理の手順")
    request = topic.requests.find_by(name: "受注処理ヒアリング")
    content = request.request_contents.first
    assert content
    assert content.context.present?
  end

  test "seed creates hearing room as finished and topic room as open" do
    topic = Topic.find_by(name: "受注処理の手順")
    request = topic.requests.first

    hearing_room = Room.find_by(request_id: request.id, chat_type: "hearing")
    assert hearing_room
    assert hearing_room.is_finished

    topic_room = Room.find_by(topic_id: topic.id, chat_type: "topic")
    assert topic_room
    assert_not topic_room.is_finished
  end

  test "seed creates hearing messages with proper structure" do
    topic = Topic.find_by(name: "受注処理の手順")
    request = topic.requests.first
    hearing_room = Room.find_by(request_id: request.id, chat_type: "hearing")

    messages = Message.where(room_id: hearing_room.id).order(:created_at)
    assert_equal 6, messages.count

    assert_equal "assistant", messages[0].message_type
    assert_equal "user", messages[1].message_type
    assert_equal messages[0].id, messages[1].question_id
  end

  test "seed creates permissions for three roles" do
    company = Company.find_by(name: "株式会社サンプル")
    folder = TopicFolder.find_by(name: "営業ナレッジ", company_id: company.id)
    permissions = Permission.where(permissible: folder)
    assert_equal 3, permissions.count

    company_admin_user = User.find_by(company_id: company.id, role: :company_admin)
    admin_perm = permissions.find_by(grantee_id: company_admin_user.id)
    assert_equal "owner", admin_perm.role

    veteran_user = User.find_by(company_id: company.id, role: :veteran)
    veteran_perm = permissions.find_by(grantee_id: veteran_user.id)
    assert_equal "editor", veteran_perm.role

    general_user = User.find_by(company_id: company.id, role: :general)
    general_perm = permissions.find_by(grantee_id: general_user.id)
    assert_equal "viewer", general_perm.role
  end

  test "seed creates data source folder and files" do
    company = Company.find_by(name: "株式会社サンプル")
    folder = DataSourceFolder.find_by(name: "社内ドキュメント", company_id: company.id)
    assert folder

    files = folder.data_source_files
    assert_equal 3, files.count
    assert files.all?(&:completed?)
  end

  test "seed links data source files to topic" do
    topic = Topic.find_by(name: "受注処理の手順")
    assert_equal 3, TopicDataSourceLink.where(topic_id: topic.id).count
  end

  test "seed is idempotent" do
    # 2回目のseed実行でデータが増えないことを確認
    initial_company_count = Company.where(name: ["株式会社サンプル", "テスト株式会社"]).count
    initial_topic_count = Topic.where(name: "受注処理の手順").count

    SeedFu.seed(Rails.root.join("db", "fixtures", "development"))

    assert_equal initial_company_count, Company.where(name: ["株式会社サンプル", "テスト株式会社"]).count
    assert_equal initial_topic_count, Topic.where(name: "受注処理の手順").count
  end

  private

  # トランザクション内で実行されるためcleanup不要
end
