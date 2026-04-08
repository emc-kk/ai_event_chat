class CreateCompanyFeatures < ActiveRecord::Migration[8.0]
  def change
    create_table :company_features, id: { type: :string, limit: 26 } do |t|
      t.string :company_id, null: false
      t.string :feature_id, null: false
      t.boolean :enabled, default: false, null: false

      t.timestamps
    end

    add_index :company_features, [:company_id, :feature_id], unique: true
    add_index :company_features, :feature_id
  end
end
