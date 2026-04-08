class FeatureManager
  class Context
    def initialize(company)
      @company = company
      @cache = nil
    end

    def enabled?(feature_name)
      feature_name = feature_name.to_s
      FeatureManagement::Features.find(feature_name) # 未定義フラグは例外

      feature = FeatureManagement::Feature.find_by(name: feature_name)
      return false unless feature

      # 親がOFFなら子もOFF
      if feature.parent.present?
        parent_cf = FeatureManagement::CompanyFeature.find_by(company: @company, feature: feature.parent)
        return false unless parent_cf&.enabled?
      end

      cf = FeatureManagement::CompanyFeature.find_by(company: @company, feature: feature)
      cf&.enabled? || false
    end
  end

  def self.for(company)
    Context.new(company)
  end

  def self.enable!(company, feature_name)
    FeatureManagement::Cascader.enable!(company, feature_name)
  end

  def self.disable!(company, feature_name)
    FeatureManagement::Cascader.disable!(company, feature_name)
  end

  def self.sync!
    FeatureManagement::Sync.call
  end
end
