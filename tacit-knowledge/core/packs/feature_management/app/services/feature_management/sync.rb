module FeatureManagement
  class Sync
    def self.call
      new.call
    end

    def call
      existing = Feature.pluck(:name).to_set
      expected = Features.all_names.map(&:to_s).to_set

      create_missing(expected - existing)
      remove_stale(existing - expected)
    end

    private

    def create_missing(names)
      names.each do |name|
        config = Features.find(name)
        parent = config[:parent] ? Feature.find_by!(name: config[:parent]) : nil

        Feature.create!(
          name: name,
          feature_type: config[:type],
          parent: parent
        )
      end
    end

    def remove_stale(names)
      Feature.where(name: names.to_a).destroy_all if names.any?
    end
  end
end
