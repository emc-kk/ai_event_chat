# Create test users for preview environments
# Only runs when PREVIEW_ENV is set (preview env)
if ENV["PREVIEW_ENV"].present?
  privileged_admin = Admin.find_by(company_id: nil)

  if privileged_admin.nil?
    puts "Privileged admin not found. Skipping preview users seed."
  else

  # Create company admins
  Company.all.each_with_index do |company, company_index|
    admin_number = company_index + 1
    company_admin = User.find_or_initialize_by(email: "admin#{admin_number}@example.com")
    company_admin.assign_attributes(
      password: "Password1!",
      password_confirmation: "Password1!",
      name: "#{company.name} 管理者",
      company_id: company.id,
      role: User.roles[:company_admin],
      creator: privileged_admin,
      confirmed_at: Time.current
    )

    if company_admin.save
      puts "Company Admin #{admin_number} created: #{company_admin.email} (#{company.name})"
    else
      puts "Failed to create company admin #{admin_number}: #{company_admin.errors.full_messages.join(', ')}"
    end
  end

  # Create regular users for each company
  departments = ["営業部", "開発部", "人事部", "経理部", "総務部"]
  Company.all.each_with_index do |company, company_index|
    3.times do |i|
      user_number = (company_index * 3) + i + 1
      user = User.find_or_initialize_by(email: "user#{user_number}@example.com")
      user.assign_attributes(
        password: "Password1!",
        password_confirmation: "Password1!",
        department: departments[i % departments.size],
        number: (user_number * 100).to_s,
        description: "テストユーザー#{user_number}の説明",
        name: "ユーザー#{user_number}",
        company_id: company.id,
        creator: privileged_admin,
        confirmed_at: Time.current,
        role: i < 2 ? User.roles[:veteran] : User.roles[:general]
      )

      if user.save
        puts "User #{user_number} created: #{user.email} (#{company.name})"
      else
        puts "Failed to create user #{user_number}: #{user.errors.full_messages.join(', ')}"
      end
    end
  end

  end # if privileged_admin
else
  puts "Skipping preview users seed (not a preview environment)"
end
