class ApplicationRecord < ActiveRecord::Base
  include UlidPk
  primary_abstract_class
  include SafeAttributes
end
