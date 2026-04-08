require "test_helper"

class FeatureManagement::CascaderTest < ActiveSupport::TestCase
  setup do
    FeatureManager.sync!
    @company = companies(:company_a)
  end

  test "enable!でBCと子がすべてONになる" do
    FeatureManagement::Cascader.enable!(@company, :hearing)

    hearing = FeatureManagement::Feature.find_by!(name: "hearing")
    assert FeatureManagement::CompanyFeature.find_by(company: @company, feature: hearing)&.enabled?

    hearing.children.each do |child|
      cf = FeatureManagement::CompanyFeature.find_by(company: @company, feature: child)
      assert cf&.enabled?, "#{child.name}がONになっていない"
    end
  end

  test "disable!でBCと子がすべてOFFになる" do
    FeatureManagement::Cascader.enable!(@company, :hearing)
    FeatureManagement::Cascader.disable!(@company, :hearing)

    hearing = FeatureManagement::Feature.find_by!(name: "hearing")
    assert_not FeatureManagement::CompanyFeature.find_by(company: @company, feature: hearing)&.enabled?

    hearing.children.each do |child|
      cf = FeatureManagement::CompanyFeature.find_by(company: @company, feature: child)
      assert_not cf&.enabled?, "#{child.name}がOFFになっていない"
    end
  end

  # depends_onカスケードテストはweb_monitorがTREEに追加された時点で復活

end
