class CreateDatasourceJobs < ActiveRecord::Migration[8.0]
  def change
    create_table :datasource_jobs, id: :string do |t|
      t.string :tenant_id, null: false
      t.string :name, null: false
      t.text :description
      t.jsonb :job_definition, null: false, default: {}
      t.string :status, null: false, default: 'active'  # active/paused/failed/schema_change

      t.timestamps
    end

    add_index :datasource_jobs, :tenant_id
    add_index :datasource_jobs, :status
  end
end
