require "test_helper"

class SkillrelayCore::DomainEventTest < ActiveSupport::TestCase
  class TestEvent < SkillrelayCore::DomainEvent
    attribute :request_id, Integer
    attribute :room_id, Integer
  end

  class ChildEvent < TestEvent
    attribute :extra, String
  end

  test "属性を定義してインスタンス化できる" do
    event = TestEvent.new(request_id: 1, room_id: 2)
    assert_equal 1, event.request_id
    assert_equal 2, event.room_id
  end

  test "occurred_atが自動設定される" do
    event = TestEvent.new(request_id: 1, room_id: 2)
    assert_kind_of Time, event.occurred_at
  end

  test "必須属性が欠けるとArgumentError" do
    assert_raises(ArgumentError) do
      TestEvent.new(request_id: 1)
    end
  end

  test "to_hでイベント名と属性がHash化される" do
    event = TestEvent.new(request_id: 1, room_id: 2)
    hash = event.to_h
    assert_equal 1, hash[:request_id]
    assert_equal 2, hash[:room_id]
    assert_includes hash[:event], "test_event"
    assert hash[:occurred_at].present?
  end

  test "event_nameはクラス名からsnake_caseで生成" do
    assert_includes TestEvent.event_name, "test_event"
  end

  test "継承時に親の属性を引き継ぐ" do
    event = ChildEvent.new(request_id: 1, room_id: 2, extra: "hello")
    assert_equal 1, event.request_id
    assert_equal "hello", event.extra
  end

  test "継承しても親クラスの属性に影響しない" do
    assert_equal 2, TestEvent.attributes.count
    assert_equal 3, ChildEvent.attributes.count
  end
end
