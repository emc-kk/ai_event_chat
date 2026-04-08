require "test_helper"

class RoomTest < ActiveSupport::TestCase
  setup do
    @company = companies(:company_a)
    @admin = admins(:company_a_admin)
    @topic = Topic.create!(
      name: "テストトピック",
      description: "テスト用",
      company: @company,
      created_by: @admin
    )
    @request = Request.create!(
      topic: @topic,
      created_by: @admin,
      status: :inhearing,
      request_type: :hearing
    )
  end

  # === find_or_create_for_chat テスト ===

  test "find_or_create_for_chat: 既存ルームがあれば返す" do
    room = Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: false
    )
    result = Room.find_or_create_for_chat(@request, "hearing")
    assert_equal room, result
  end

  test "find_or_create_for_chat: 既存ルームがなければ新規作成" do
    assert_difference "Room.count", 1 do
      Room.find_or_create_for_chat(@request, "hearing")
    end
  end

  test "find_or_create_for_chat: rehearingステータスの場合unfishinedを返す" do
    @request.update_column(:status, Request.statuses[:rehearing])
    room = Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: false
    )
    result = Room.find_or_create_for_chat(@request, "hearing")
    assert_equal room, result
  end

  test "find_or_create_for_chat: rehearingで未完了ルームがなければ新規作成" do
    @request.update_column(:status, Request.statuses[:rehearing])
    Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: true,
      is_deleted: false
    )
    assert_difference "Room.count", 1 do
      Room.find_or_create_for_chat(@request, "hearing")
    end
  end

  # === hearing? / topic? テスト ===

  test "hearing?: chat_typeがhearingならtrue" do
    room = Room.new(chat_type: "hearing")
    assert room.hearing?
    assert_not room.topic?
  end

  test "topic?: chat_typeがtopicならtrue" do
    room = Room.new(chat_type: "topic")
    assert room.topic?
    assert_not room.hearing?
  end

  # === finish! / soft_delete! / restore! テスト ===

  test "finish!: is_finishedをtrueに更新" do
    room = Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: false
    )
    room.send(:finish!)
    assert room.reload.is_finished
  end

  test "soft_delete!: is_deletedをtrueに更新" do
    room = Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: false
    )
    room.send(:soft_delete!)
    assert room.reload.is_deleted
  end

  test "restore!: is_deletedをfalseに更新" do
    room = Room.create!(
      request: @request,
      topic: @topic,
      chat_type: "hearing",
      is_finished: false,
      is_deleted: true
    )
    room.send(:restore!)
    assert_not room.reload.is_deleted
  end
end
