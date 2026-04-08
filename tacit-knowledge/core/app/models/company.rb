class Company < ApplicationRecord
  # Associations
  has_many :admins, foreign_key: :company_id, primary_key: :id
  has_many :users, foreign_key: :company_id, primary_key: :id
  has_many :topics, foreign_key: :company_id, primary_key: :id
  has_many :topic_folders, dependent: :destroy
  has_many :permissions, dependent: :destroy
  has_many :data_source_folders, dependent: :destroy
  has_many :data_source_files, dependent: :destroy
  has_many :glossary_terms, class_name: "CompanyGlossaryTerm", dependent: :destroy
  has_many :data_acquisition_jobs, dependent: :destroy
  has_many :data_acquisition_records, dependent: :destroy

  # Validations
  validates :name, presence: true, length: { maximum: 255 }

  enum :status, { inactive: 0, active: 1 }, prefix: true

  def self.ransackable_attributes(auth_object = nil)
    %w[name status]
  end
end
