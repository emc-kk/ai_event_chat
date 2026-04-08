module SafeAttributes
  extend ActiveSupport::Concern

  class_methods do
    def safe_attributes(*attrs)
      attrs.each do |attr|
        define_method(attr) do
          has_attribute?(attr) ? read_attribute(attr) : instance_variable_get("@#{attr}")
        end

        define_method("#{attr}=") do |val|
          has_attribute?(attr) ? write_attribute(attr, val) : instance_variable_set("@#{attr}", val)
        end
      end
    end
  end
end
