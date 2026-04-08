class AddSshColumnsToDatasourceTasks < ActiveRecord::Migration[8.0]
  def change
    # テーブルは000008で data_acquisition_tasks にリネーム済みの可能性がある
    target_table = if table_exists?(:datasource_tasks)
                     :datasource_tasks
                   elsif table_exists?(:data_acquisition_tasks)
                     :data_acquisition_tasks
                   else
                     return
                   end

    unless column_exists?(target_table, :dispatch_target)
      add_column target_table, :dispatch_target, :string, null: false, default: "sqs"
    end
    unless column_exists?(target_table, :assigned_instance_id)
      add_column target_table, :assigned_instance_id, :string
    end
    unless column_exists?(target_table, :assigned_at)
      add_column target_table, :assigned_at, :datetime
    end

    unless index_exists?(target_table, [:dispatch_target, :status])
      add_index target_table, [:dispatch_target, :status], name: "idx_tasks_dispatch_status"
    end
    unless index_exists?(target_table, :assigned_instance_id)
      add_index target_table, :assigned_instance_id
    end
  end
end
