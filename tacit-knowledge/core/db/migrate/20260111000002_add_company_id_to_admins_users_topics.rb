class AddCompanyIdToAdminsUsersTopics < ActiveRecord::Migration[8.0]
  def change
    # Add company_id to admins (null = privileged user)
    add_column :admins, :company_id, :string, limit: 26
    add_index :admins, :company_id

    # Add company_id to users (null = privileged user)
    add_column :users, :company_id, :string, limit: 26
    add_index :users, :company_id

    # Add company_id to topics (null = privileged user's topic)
    add_column :topics, :company_id, :string, limit: 26
    add_index :topics, :company_id

    # Add foreign keys
    add_foreign_key :admins, :companies, column: :company_id, primary_key: :id, on_delete: :nullify
    add_foreign_key :users, :companies, column: :company_id, primary_key: :id, on_delete: :nullify
    add_foreign_key :topics, :companies, column: :company_id, primary_key: :id, on_delete: :nullify
  end
end
