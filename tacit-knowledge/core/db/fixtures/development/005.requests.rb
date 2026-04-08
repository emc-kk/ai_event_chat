company = Company.find_by(name: "株式会社サンプル")
company_admin = User.find_by(email: "admin1@example.com")
topic = Topic.find_by(name: "受注処理の手順", company_id: company&.id)
veteran_user = User.find_by(email: "user1@example.com")

unless company && company_admin && topic && veteran_user
  puts "005: Skip - Required records not found"
  return
end

request = Request.find_or_initialize_by(topic_id: topic.id, name: "受注処理ヒアリング")
request.assign_attributes(
  respondent: veteran_user,
  created_by: company_admin,
  status: :completed,
  request_type: :hearing,
  description: "ベテラン社員への受注処理に関するヒアリング"
)

if request.save
  puts "Request created: #{request.name} (ID: #{request.id}, status: #{request.status})"

  content = RequestContent.find_or_initialize_by(request_id: request.id)
  content.assign_attributes(
    context: "受注処理の全体的な流れと、特に判断が必要な場面について教えてください。",
    comment: "10年以上の経験を持つベテラン社員へのヒアリング結果"
  )

  if content.save
    puts "RequestContent created (ID: #{content.id})"
  else
    puts "Failed to create RequestContent:"
    content.errors.full_messages.each { |msg| puts "  - #{msg}" }
  end
else
  puts "Failed to create Request:"
  request.errors.full_messages.each { |msg| puts "  - #{msg}" }
end
