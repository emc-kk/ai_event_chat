company = Company.find_by(name: "株式会社サンプル")
company_admin = User.find_by(email: "admin1@example.com")

unless company && company_admin
  puts "003: Skip - Company or company_admin not found"
  return
end

folder = TopicFolder.find_or_initialize_by(name: "営業ナレッジ", company_id: company.id)
folder.assign_attributes(
  created_by: company_admin,
  parent_id: nil
)

if folder.save
  puts "TopicFolder created: #{folder.name} (ID: #{folder.id})"
else
  puts "Failed to create TopicFolder:"
  folder.errors.full_messages.each { |msg| puts "  - #{msg}" }
end
