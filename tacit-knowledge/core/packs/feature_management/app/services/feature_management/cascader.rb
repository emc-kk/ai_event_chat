module FeatureManagement
  class Cascader
    def self.enable!(company, feature_name)
      new(company).enable!(feature_name)
    end

    def self.disable!(company, feature_name)
      new(company).disable!(feature_name)
    end

    def initialize(company)
      @company = company
    end

    def enable!(feature_name)
      feature = Feature.by_name(feature_name)

      ActiveRecord::Base.transaction do
        set_enabled(feature, true)
        enable_children(feature)
        enable_dependencies(feature_name)
      end
    end

    def disable!(feature_name)
      feature = Feature.by_name(feature_name)

      ActiveRecord::Base.transaction do
        set_enabled(feature, false)
        disable_children(feature)
        disable_dependents(feature_name)
      end
    end

    private

    attr_reader :company

    def set_enabled(feature, enabled)
      cf = CompanyFeature.find_or_initialize_by(company: company, feature: feature)
      cf.update!(enabled: enabled)
    end

    def enable_children(feature)
      feature.children.each { |child| set_enabled(child, true) }
    end

    def disable_children(feature)
      feature.children.each { |child| set_enabled(child, false) }
    end

    def enable_dependencies(feature_name)
      Features.dependencies_of(feature_name).each do |dep_name|
        dep_feature = Feature.by_name(dep_name)
        cf = CompanyFeature.find_by(company: company, feature: dep_feature)
        enable!(dep_name) unless cf&.enabled?
      end
    end

    def disable_dependents(feature_name)
      Features.dependents_of(feature_name).each do |dep_name|
        dep_feature = Feature.by_name(dep_name)
        cf = CompanyFeature.find_by(company: company, feature: dep_feature)
        disable!(dep_name) if cf&.enabled?
      end
    end
  end
end
