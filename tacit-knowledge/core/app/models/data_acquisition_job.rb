class DataAcquisitionJob < ApplicationRecord
  self.table_name = "data_acquisition_jobs"

  belongs_to :company

  has_many :data_acquisition_job_runs, foreign_key: :job_id, dependent: :destroy
  has_many :data_acquisition_tasks, foreign_key: :job_id, dependent: :destroy
  has_many :data_acquisition_records, foreign_key: :job_id, dependent: :destroy

  validates :company_id, presence: true
  validates :name, presence: true
  validates :status, inclusion: { in: %w[active paused failed schema_change] }

  scope :active, -> { where(status: 'active') }
  scope :for_company, ->(company_id) { where(company_id: company_id) }
end
