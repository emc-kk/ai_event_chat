company = Company.find_by(name: "株式会社サンプル")
company_admin = User.find_by(email: "admin1@example.com")
folder = TopicFolder.find_by(name: "営業ナレッジ", company_id: company&.id)

unless company && company_admin && folder
  puts "004: Skip - Required records not found"
  return
end

topic = Topic.find_or_initialize_by(name: "受注処理の手順", company_id: company.id)
topic.assign_attributes(
  description: "受注から出荷までの業務フロー・判断基準をまとめたトピック",
  created_by: company_admin,
  folder_id: folder.id,
  status: :completed,
  icon_color: :blue,
  uuid: topic.uuid || SecureRandom.uuid
)

if topic.save
  puts "Topic created: #{topic.name} (ID: #{topic.id}, status: #{topic.status})"
else
  puts "Failed to create Topic:"
  topic.errors.full_messages.each { |msg| puts "  - #{msg}" }
end
