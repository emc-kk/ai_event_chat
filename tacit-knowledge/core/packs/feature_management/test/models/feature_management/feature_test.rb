require "test_helper"

class FeatureManagement::FeatureTest < ActiveSupport::TestCase
  setup do
    FeatureManager.sync!
  end

  test "sync後にTREE定数分のレコードが作成される" do
    expected = FeatureManagement::Features.all_names.count
    assert_equal expected, FeatureManagement::Feature.count
  end

  test "BCフラグはparent_idがnil" do
    hearing = FeatureManagement::Feature.find_by!(name: "hearing")
    assert_nil hearing.parent_id
    assert hearing.feature_type_bc?
  end

  test "子フラグはparentを持つ" do
    hearing_form = FeatureManagement::Feature.find_by!(name: "hearing_form")
    assert_equal "hearing", hearing_form.parent.name
    assert hearing_form.feature_type_screen?
  end

  test "3階層目は作れない" do
    child = FeatureManagement::Feature.find_by!(name: "hearing_form")
    grandchild = FeatureManagement::Feature.new(
      name: "too_deep",
      feature_type: :screen,
      parent: child
    )
    assert_not grandchild.valid?
    assert_includes grandchild.errors[:parent_id], "ツリー深さは2階層まで"
  end

  test "nameはユニーク" do
    dup = FeatureManagement::Feature.new(name: "hearing", feature_type: :bc)
    assert_not dup.valid?
  end
end
