class ReplaceTenantIdWithCompanyId < ActiveRecord::Migration[8.0]
  def up
    # datasource → data_acquisition リネーム前に実行される場合を考慮
    jobs_table = table_exists?(:data_acquisition_jobs) ? :data_acquisition_jobs : :datasource_jobs
    records_table = table_exists?(:data_acquisition_records) ? :data_acquisition_records : :datasource_records

    return unless table_exists?(jobs_table) && table_exists?(records_table)

    # 1. jobs: company_id 追加（冪等: 既に存在する場合はスキップ）
    unless column_exists?(jobs_table, :company_id)
      add_column jobs_table, :company_id, :string, limit: 26
    end

    # 2. records: company_id 追加（冪等: 既に存在する場合はスキップ）
    unless column_exists?(records_table, :company_id)
      add_column records_table, :company_id, :string, limit: 26
    end

    # 3. 富士電機 company レコードを作成 (ULID生成)
    execute <<~SQL
      INSERT INTO companies (id, name, description, status, created_at, updated_at)
      VALUES (
        '01JQFUJIELECTRIC01',
        '富士電機株式会社',
        'エネルギー・環境事業のデータ取得対象企業',
        1,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    SQL

    # 4. 既存データのマイグレーション: tenant_id → company_id
    if column_exists?(jobs_table, :tenant_id)
      execute <<~SQL
        UPDATE #{jobs_table}
        SET company_id = '01JQFUJIELECTRIC01'
        WHERE tenant_id = 'fuji-electric';
      SQL
    end

    if column_exists?(records_table, :tenant_id)
      execute <<~SQL
        UPDATE #{records_table}
        SET company_id = '01JQFUJIELECTRIC01'
        WHERE tenant_id = 'fuji-electric';
      SQL
    end

    # 5. company_id NOT NULL 制約 + FK
    change_column_null jobs_table, :company_id, false, '01JQFUJIELECTRIC01'
    change_column_null records_table, :company_id, false, '01JQFUJIELECTRIC01'

    unless foreign_key_exists?(jobs_table, :companies, column: :company_id)
      add_foreign_key jobs_table, :companies, column: :company_id, on_delete: :cascade
    end
    unless foreign_key_exists?(records_table, :companies, column: :company_id)
      add_foreign_key records_table, :companies, column: :company_id, on_delete: :cascade
    end

    unless index_exists?(jobs_table, :company_id)
      add_index jobs_table, :company_id
    end
    unless index_exists?(records_table, [:company_id, :record_type, :fetched_at])
      add_index records_table, [:company_id, :record_type, :fetched_at],
                name: "idx_#{records_table}_company_type_fetched"
    end

    # 6. 旧カラム・インデックス削除（tenant_idが残っている場合のみ）
    if column_exists?(jobs_table, :tenant_id)
      remove_index jobs_table, :tenant_id rescue nil
      remove_column jobs_table, :tenant_id
    end
    if column_exists?(records_table, :tenant_id)
      remove_index records_table, column: [:tenant_id, :record_type, :fetched_at] rescue nil
      remove_column records_table, :tenant_id
    end
  end

  def down
    jobs_table = table_exists?(:data_acquisition_jobs) ? :data_acquisition_jobs : :datasource_jobs
    records_table = table_exists?(:data_acquisition_records) ? :data_acquisition_records : :datasource_records

    add_column jobs_table, :tenant_id, :string
    add_column records_table, :tenant_id, :string

    execute "UPDATE #{jobs_table} SET tenant_id = 'fuji-electric' WHERE company_id = '01JQFUJIELECTRIC01'"
    execute "UPDATE #{records_table} SET tenant_id = 'fuji-electric' WHERE company_id = '01JQFUJIELECTRIC01'"

    change_column_null jobs_table, :tenant_id, false, 'unknown'
    change_column_null records_table, :tenant_id, false, 'unknown'

    add_index jobs_table, :tenant_id
    add_index records_table, [:tenant_id, :record_type, :fetched_at],
              name: "idx_#{records_table}_tenant_type_fetched"

    remove_foreign_key jobs_table, :companies
    remove_foreign_key records_table, :companies
    remove_column jobs_table, :company_id
    remove_column records_table, :company_id
  end
end
