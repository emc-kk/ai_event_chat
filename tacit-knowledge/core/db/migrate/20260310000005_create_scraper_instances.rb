class CreateScraperInstances < ActiveRecord::Migration[8.0]
  def change
    create_table :scraper_instances, id: :string, if_not_exists: true do |t|
      t.string  :name,               null: false
      t.string  :host,               null: false
      t.integer :port,               default: 22
      t.string  :ssh_user,           default: "ec2-user"
      t.string  :ssh_key_secret_id
      t.string  :status,             null: false, default: "active"
      t.string  :account_id
      t.string  :region
      t.string  :runtime,            default: "docker"
      t.integer :max_concurrency,    default: 2
      t.integer :current_tasks,      default: 0
      t.jsonb   :resource_thresholds, default: { cpu_max: 70, memory_max: 85, network_max_mbps: 100 }
      t.jsonb   :last_resource_check
      t.datetime :last_checked_at
      t.jsonb   :capabilities,       default: %w[web_scrape csv_download pdf_download api]
      t.jsonb   :tags,               default: {}

      t.timestamps
    end

    unless index_exists?(:scraper_instances, :status)
      add_index :scraper_instances, :status
    end
    unless index_exists?(:scraper_instances, :name)
      add_index :scraper_instances, :name, unique: true
    end
  end
end
