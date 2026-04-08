class DataAcquisitionRecord < ApplicationRecord
  self.table_name = "data_acquisition_records"

  belongs_to :company
  belongs_to :data_acquisition_job, foreign_key: :job_id

  validates :company_id, presence: true

  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :by_type, ->(type) { where(record_type: type) }
  scope :recent, -> { order(fetched_at: :desc) }
end
