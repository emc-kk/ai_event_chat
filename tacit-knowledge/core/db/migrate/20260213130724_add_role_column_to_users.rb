class AddRoleColumnToUsers < ActiveRecord::Migration[8.0]
  def change
    # 権限. 既存のデータは1=ベテランとする
    add_column :users, :role, :integer, comment: "権限. 0=一般, 1=熟練者, 9=管理者", null: false, default: User.roles[:veteran]
  end
end
