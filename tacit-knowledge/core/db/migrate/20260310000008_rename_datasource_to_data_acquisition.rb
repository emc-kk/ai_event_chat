class RenameDatasourceToDataAcquisition < ActiveRecord::Migration[8.0]
  def change
    # 各テーブルが旧名で存在する場合のみリネーム（既にリネーム済みならスキップ）
    if table_exists?(:datasource_jobs) && !table_exists?(:data_acquisition_jobs)
      rename_table :datasource_jobs, :data_acquisition_jobs
    end
    if table_exists?(:datasource_job_runs) && !table_exists?(:data_acquisition_job_runs)
      rename_table :datasource_job_runs, :data_acquisition_job_runs
    end
    if table_exists?(:datasource_tasks) && !table_exists?(:data_acquisition_tasks)
      rename_table :datasource_tasks, :data_acquisition_tasks
    end
    if table_exists?(:datasource_records) && !table_exists?(:data_acquisition_records)
      rename_table :datasource_records, :data_acquisition_records
    end

    # インデックスのリネーム（リネーム後のテーブルで旧名インデックスが存在する場合のみ）
    if table_exists?(:data_acquisition_tasks) &&
       index_exists?(:data_acquisition_tasks, [:dispatch_target, :status], name: "idx_tasks_dispatch_status")
      rename_index :data_acquisition_tasks, "idx_tasks_dispatch_status", "idx_acq_tasks_dispatch_status"
    end
  end
end
