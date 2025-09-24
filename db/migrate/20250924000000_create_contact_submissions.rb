class CreateContactSubmissions < ActiveRecord::Migration[7.1]
  def change
    create_table :contact_submissions, id: :string, limit: 26 do |t|
      t.string :company_name, null: false
      t.string :email, null: false
      t.json :interested_services, null: false, comment: 'Array of service names user is interested in'
      t.json :service_ids, null: false, comment: 'Array of service IDs corresponding to interested services'

      t.timestamps
    end

    add_index :contact_submissions, :email
    add_index :contact_submissions, :company_name
    add_index :contact_submissions, :created_at
  end
end