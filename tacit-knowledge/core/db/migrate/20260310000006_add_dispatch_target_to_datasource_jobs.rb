class AddDispatchTargetToDatasourceJobs < ActiveRecord::Migration[8.0]
  def change
    # テーブルは000008で data_acquisition_jobs にリネーム済みの可能性がある
    target_table = if table_exists?(:datasource_jobs)
                     :datasource_jobs
                   elsif table_exists?(:data_acquisition_jobs)
                     :data_acquisition_jobs
                   else
                     return # テーブルが存在しない場合はスキップ
                   end

    unless column_exists?(target_table, :dispatch_target)
      add_column target_table, :dispatch_target, :string, null: false, default: "sqs"
    end
  end
end
