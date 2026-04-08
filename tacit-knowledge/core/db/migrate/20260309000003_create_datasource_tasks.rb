class CreateDatasourceTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :datasource_tasks, id: :string do |t|
      t.string :job_id, null: false
      t.string :run_id, null: false
      t.string :status, null: false, default: 'queued'  # queued/processing/done/failed
      t.jsonb :task_payload, null: false, default: {}
      t.string :worker_id
      t.integer :attempt, default: 1
      t.datetime :completed_at

      t.timestamps
    end

    add_index :datasource_tasks, :job_id
    add_index :datasource_tasks, :run_id
    add_index :datasource_tasks, :status
    add_index :datasource_tasks, [:status, :created_at]
    add_foreign_key :datasource_tasks, :datasource_jobs, column: :job_id
    add_foreign_key :datasource_tasks, :datasource_job_runs, column: :run_id
  end
end
