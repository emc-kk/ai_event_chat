module SkillrelayCore
  class DomainEvent
    class << self
      def attribute(name, type = nil)
        attributes << { name: name, type: type }

        define_method(name) { @attributes[name] }
      end

      def attributes
        @attributes ||= []
      end

      def inherited(subclass)
        super
        subclass.instance_variable_set(:@attributes, attributes.dup)
      end

      def event_name
        name.underscore.tr("/", ".")
      end
    end

    def initialize(**kwargs)
      @attributes = {}
      self.class.attributes.each do |attr|
        key = attr[:name]
        raise ArgumentError, "#{key} is required for #{self.class.name}" unless kwargs.key?(key)
        @attributes[key] = kwargs[key]
      end
      @occurred_at = Time.current
    end

    attr_reader :occurred_at

    def to_h
      @attributes.merge(event: self.class.event_name, occurred_at: occurred_at.iso8601)
    end
  end
end
