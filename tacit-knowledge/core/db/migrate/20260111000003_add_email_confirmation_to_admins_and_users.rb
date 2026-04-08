class AddEmailConfirmationToAdminsAndUsers < ActiveRecord::Migration[8.0]
  def change
    # Add confirmation fields to admins
    add_column :admins, :confirmation_token, :string
    add_column :admins, :confirmed_at, :datetime
    add_column :admins, :confirmation_sent_at, :datetime
    add_column :admins, :unconfirmed_email, :string
    add_index :admins, :confirmation_token, unique: true

    # Add confirmation fields to users
    add_column :users, :confirmation_token, :string
    add_column :users, :confirmed_at, :datetime
    add_column :users, :confirmation_sent_at, :datetime
    add_column :users, :unconfirmed_email, :string
    add_index :users, :confirmation_token, unique: true

    # Mark existing records as confirmed
    reversible do |dir|
      dir.up do
        execute "UPDATE admins SET confirmed_at = NOW() WHERE confirmed_at IS NULL"
        execute "UPDATE users SET confirmed_at = NOW() WHERE confirmed_at IS NULL"
      end
    end
  end
end
