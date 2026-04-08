require "test_helper"

class HearingStepStateTest < ActiveSupport::TestCase
  # === active? テスト ===

  test "active?: current_step_statusがactiveならtrue" do
    state = HearingStepState.new(current_step_status: "active")
    assert state.active?
  end

  test "active?: current_step_statusがcompletedならfalse" do
    state = HearingStepState.new(current_step_status: "completed")
    assert_not state.active?
  end

  # === completed? テスト ===

  test "completed?: current_step_statusがcompletedならtrue" do
    state = HearingStepState.new(current_step_status: "completed")
    assert state.completed?
  end

  test "completed?: current_step_statusがactiveならfalse" do
    state = HearingStepState.new(current_step_status: "active")
    assert_not state.completed?
  end
end
