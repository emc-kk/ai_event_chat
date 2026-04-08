class DataAcquisitionJobRun < ApplicationRecord
  self.table_name = "data_acquisition_job_runs"

  belongs_to :data_acquisition_job, foreign_key: :job_id
  has_many :data_acquisition_tasks, foreign_key: :run_id, dependent: :destroy

  validates :status, inclusion: { in: %w[running completed failed] }

  scope :recent, -> { order(started_at: :desc) }
end
