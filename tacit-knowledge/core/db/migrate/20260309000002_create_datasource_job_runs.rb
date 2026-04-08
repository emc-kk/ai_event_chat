class CreateDatasourceJobRuns < ActiveRecord::Migration[8.0]
  def change
    create_table :datasource_job_runs, id: :string do |t|
      t.string :job_id, null: false
      t.string :status, null: false, default: 'running'  # running/completed/failed
      t.datetime :started_at
      t.datetime :completed_at
      t.integer :tasks_total, default: 0
      t.integer :tasks_completed, default: 0
      t.integer :tasks_failed, default: 0

      t.timestamps
    end

    add_index :datasource_job_runs, :job_id
    add_index :datasource_job_runs, :status
    add_foreign_key :datasource_job_runs, :datasource_jobs, column: :job_id
  end
end
