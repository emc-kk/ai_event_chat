company = Company.find_by(name: "株式会社サンプル")
privileged_admin = Admin.find_by(company_id: nil)
topic_folder = TopicFolder.find_by(name: "営業ナレッジ", company_id: company&.id)
ds_folder = DataSourceFolder.find_by(name: "社内ドキュメント", company_id: company&.id)

# 同じ会社に所属するユーザーを取得
company_admin_user = User.find_by(company_id: company.id, role: :company_admin)
veteran_user = User.find_by(company_id: company.id, role: :veteran)
general_user = User.find_by(company_id: company.id, role: :general)

unless company && privileged_admin && topic_folder && company_admin_user && veteran_user && general_user
  puts "007: Skip - Required records not found"
  return
end

# 権限設定: TopicFolder + DataSourceFolder
[topic_folder, ds_folder].compact.each do |resource|
  [
    { user: company_admin_user, role: :owner, label: "company_admin → owner" },
    { user: veteran_user, role: :editor, label: "veteran → editor" },
    { user: general_user, role: :viewer, label: "general → viewer" }
  ].each do |perm_data|
    perm = Permission.find_or_initialize_by(
      permissible_type: resource.class.name,
      permissible_id: resource.id,
      grantee_type: "User",
      grantee_id: perm_data[:user].id
    )
    perm.assign_attributes(
      company_id: company.id,
      role: perm_data[:role],
      granted_by_id: privileged_admin.id
    )

    if perm.save
      puts "Permission: #{resource.class.name}(#{resource.name}) #{perm_data[:label]}"
    else
      puts "Failed to create permission:"
      perm.errors.full_messages.each { |msg| puts "  - #{msg}" }
    end
  end
end
