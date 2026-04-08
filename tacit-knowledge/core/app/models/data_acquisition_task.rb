class DataAcquisitionTask < ApplicationRecord
  self.table_name = "data_acquisition_tasks"

  belongs_to :data_acquisition_job, foreign_key: :job_id
  belongs_to :data_acquisition_job_run, foreign_key: :run_id

  validates :status, inclusion: { in: %w[queued processing done failed] }
end
