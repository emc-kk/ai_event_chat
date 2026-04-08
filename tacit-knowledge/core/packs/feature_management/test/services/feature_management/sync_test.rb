require "test_helper"

class FeatureManagement::SyncTest < ActiveSupport::TestCase
  test "sync!でTREE定数がDBに反映される" do
    FeatureManagement::Feature.destroy_all
    assert_equal 0, FeatureManagement::Feature.count

    FeatureManagement::Sync.call
    assert_equal FeatureManagement::Features.all_names.count, FeatureManagement::Feature.count
  end

  test "2回実行しても冪等" do
    FeatureManagement::Sync.call
    count = FeatureManagement::Feature.count

    FeatureManagement::Sync.call
    assert_equal count, FeatureManagement::Feature.count
  end

  test "DBにある余剰レコードは削除される" do
    FeatureManagement::Sync.call
    FeatureManagement::Feature.create!(name: "stale_feature", feature_type: :bc)

    FeatureManagement::Sync.call
    assert_nil FeatureManagement::Feature.find_by(name: "stale_feature")
  end
end
