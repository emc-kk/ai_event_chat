require "faker"

privileged_admin = Admin.find_by(company_id: nil)

# Create company admins as users with company_admin role
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
    puts "Company Admin #{admin_number} created successfully!"
    puts "  ID: #{company_admin.id}"
    puts "  Email: #{company_admin.email}"
    puts "  Name: #{company_admin.name}"
    puts "  Company: #{company.name}"
    puts "  Role: company_admin"
  else
    puts "Failed to create company admin #{admin_number}:"
    company_admin.errors.full_messages.each { |msg| puts "  - #{msg}" }
  end
end

# Create regular users for each company
Company.all.each_with_index do |company, company_index|
  3.times do |i|
    user_number = (company_index * 3) + i + 1
    user = User.find_or_initialize_by(email: "user#{user_number}@example.com")
    user.assign_attributes(
      password: "Password1!",
      password_confirmation: "Password1!",
      department: ["営業部", "開発部", "人事部", "経理部", "総務部"].sample,
      number: Faker::Number.between(from: 1, to: 30).to_s,
      description: Faker::Lorem.sentence(word_count: 10),
      name: "ユーザー#{user_number}",
      company_id: company.id,
      creator: privileged_admin,
      confirmed_at: Time.current,
      # 最初の2名は熟練者、残りの1名は一般ユーザー
      role: (0..1).include?(i) ? User.roles[:veteran] : User.roles[:general]
    )

    if user.save
      puts "User #{user_number} created successfully!"
      puts "  ID: #{user.id}"
      puts "  Email: #{user.email}"
      puts "  Name: #{user.name}"
      puts "  Company: #{company.name}"
      puts "  Department: #{user.department}"
    else
      puts "Failed to create user #{user_number}:"
      user.errors.full_messages.each { |msg| puts "  - #{msg}" }
    end
  end
end
