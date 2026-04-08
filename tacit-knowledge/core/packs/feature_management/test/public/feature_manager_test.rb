require "test_helper"

class FeatureManagerTest < ActiveSupport::TestCase
  setup do
    FeatureManager.sync!
    @company = companies(:company_a)
  end

  test "for(company).enabled? 未設定ならfalse" do
    assert_not FeatureManager.for(@company).enabled?(:hearing)
  end

  test "enable!後にenabled?がtrue" do
    FeatureManager.enable!(@company, :hearing)
    assert FeatureManager.for(@company).enabled?(:hearing)
  end

  test "disable!後にenabled?がfalse" do
    FeatureManager.enable!(@company, :hearing)
    FeatureManager.disable!(@company, :hearing)
    assert_not FeatureManager.for(@company).enabled?(:hearing)
  end

  test "親がOFFなら子もfalse" do
    # 子だけONにしても親がOFFならfalse
    feature = FeatureManagement::Feature.find_by!(name: "hearing_form")
    FeatureManagement::CompanyFeature.create!(company: @company, feature: feature, enabled: true)

    assert_not FeatureManager.for(@company).enabled?(:hearing_form)
  end

  test "親子ともにONなら子もtrue" do
    FeatureManager.enable!(@company, :hearing)
    assert FeatureManager.for(@company).enabled?(:hearing_form)
  end

  test "未定義フラグはArgumentError" do
    assert_raises(ArgumentError) do
      FeatureManager.for(@company).enabled?(:nonexistent)
    end
  end

  test "sync!はTREE定数をDBに反映" do
    FeatureManagement::Feature.destroy_all
    FeatureManager.sync!
    assert FeatureManagement::Feature.count > 0
  end
end
