module FeatureManagement
  module Features
    TREE = {
      hearing: {
        type: :bc,
        children: {
          hearing_form: { type: :screen },
          hearing_result: { type: :screen },
          plan_generation_job: { type: :background }
        }
      },
      manual: {
        type: :bc,
        children: {
          manual_list: { type: :screen },
          manual_generation_job: { type: :background }
        }
      },
      datasource: {
        type: :bc,
        children: {
          datasource_list: { type: :screen },
          datasource_upload: { type: :screen },
          file_indexing_job: { type: :background }
        }
      }
    }.freeze

    def self.all_names
      names = []
      TREE.each do |name, config|
        names << name
        config[:children]&.each_key { |child| names << child }
      end
      names
    end

    def self.find(name)
      name = name.to_sym
      TREE.each do |root_name, config|
        return { name: root_name, **config, parent: nil } if root_name == name
        if config[:children]&.key?(name)
          return { name: name, **config[:children][name], parent: root_name }
        end
      end
      raise ArgumentError, "未定義のフラグ: #{name}"
    end

    def self.dependents_of(name)
      name = name.to_sym
      TREE.select { |_, c| c[:depends_on]&.include?(name) }.keys
    end

    def self.dependencies_of(name)
      name = name.to_sym
      TREE.dig(name, :depends_on) || []
    end
  end
end
