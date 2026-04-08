class DataSourceFile < ApplicationRecord
  include Permissible

  # Associations
  belongs_to :company
  belongs_to :folder, class_name: "DataSourceFolder", optional: true
  belongs_to :created_by, polymorphic: true
  belongs_to :updated_by, polymorphic: true, optional: true
  has_many :topic_data_source_links, dependent: :destroy
  has_many :linked_topics, through: :topic_data_source_links, source: :topic
  has_many :request_data_source_links, dependent: :destroy
  has_many :linked_requests, through: :request_data_source_links, source: :request

  # Soft delete
  acts_as_paranoid

  # Enums
  enum :ai_status, { pending: 0, processing: 1, completed: 2, failed: 3 }, default: :pending

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :key, presence: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :in_folder, ->(folder_id) { where(folder_id: folder_id) }

  def self.ransackable_attributes(auth_object = nil)
    %w[name file_type ai_status created_at updated_at]
  end

  def file_extension
    File.extname(name).delete(".").downcase
  end

  private

  def permission_parent
    folder
  end
end
