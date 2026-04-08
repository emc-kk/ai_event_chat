class CreateDatasourceRecords < ActiveRecord::Migration[8.0]
  def change
    create_table :datasource_records, id: :string do |t|
      t.string :tenant_id, null: false
      t.string :job_id, null: false
      t.string :run_id
      t.string :task_id
      t.string :record_type
      t.jsonb :data, null: false, default: {}
      t.string :source_url
      t.string :raw_s3_path
      t.datetime :fetched_at

      t.timestamps
    end

    add_index :datasource_records, [:tenant_id, :record_type, :fetched_at],
              name: 'idx_datasource_records_tenant_type_fetched'
    add_index :datasource_records, :job_id
    add_foreign_key :datasource_records, :datasource_jobs, column: :job_id
  end
end
