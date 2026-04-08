require "test_helper"

class FeatureManagement::CompanyFeatureTest < ActiveSupport::TestCase
  setup do
    FeatureManager.sync!
    @company = companies(:company_a)
    @feature = FeatureManagement::Feature.find_by!(name: "hearing")
  end

  test "企業とフラグの組み合わせでレコード作成できる" do
    cf = FeatureManagement::CompanyFeature.create!(
      company: @company,
      feature: @feature,
      enabled: true
    )
    assert cf.persisted?
    assert cf.enabled?
  end

  test "同じ企業・フラグの組み合わせは重複不可" do
    FeatureManagement::CompanyFeature.create!(
      company: @company,
      feature: @feature,
      enabled: true
    )
    dup = FeatureManagement::CompanyFeature.new(
      company: @company,
      feature: @feature,
      enabled: false
    )
    assert_not dup.valid?
  end

  test "enabledのデフォルトはfalse" do
    cf = FeatureManagement::CompanyFeature.create!(
      company: @company,
      feature: @feature
    )
    assert_not cf.enabled?
  end
end
