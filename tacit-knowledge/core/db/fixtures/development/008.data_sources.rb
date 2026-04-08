company = Company.find_by(name: "株式会社サンプル")
company_admin = User.find_by(email: "admin1@example.com")
topic = Topic.find_by(name: "受注処理の手順", company_id: company&.id)

unless company && company_admin
  puts "008: Skip - Required records not found"
  return
end

# DataSourceFolder
folder = DataSourceFolder.find_or_initialize_by(name: "社内ドキュメント", company_id: company.id)
folder.assign_attributes(
  created_by: company_admin,
  parent_id: nil
)

if folder.save
  puts "DataSourceFolder created: #{folder.name} (ID: #{folder.id})"
else
  puts "Failed to create DataSourceFolder:"
  folder.errors.full_messages.each { |msg| puts "  - #{msg}" }
  return
end

# DataSourceFiles
files_data = [
  { name: "受注処理マニュアル.pdf", key: "seed/sample.pdf", file_type: "pdf" },
  { name: "受注チェックリスト.csv", key: "seed/sample.csv", file_type: "csv" },
  { name: "受注処理FAQ.txt", key: "seed/sample.txt", file_type: "txt" }
]

files_data.each do |file_data|
  file = DataSourceFile.find_or_initialize_by(name: file_data[:name], company_id: company.id)
  file.assign_attributes(
    folder_id: folder.id,
    key: file_data[:key],
    file_type: file_data[:file_type],
    file_size: 1024,
    ai_status: :completed,
    created_by: company_admin
  )

  if file.save
    puts "DataSourceFile created: #{file.name} (ai_status: #{file.ai_status})"

    # TopicDataSourceLink
    if topic
      link = TopicDataSourceLink.find_or_initialize_by(topic_id: topic.id, data_source_file_id: file.id)
      link.assign_attributes(linked_by: company_admin)
      if link.save
        puts "  Linked to topic: #{topic.name}"
      else
        puts "  Failed to link:"
        link.errors.full_messages.each { |msg| puts "    - #{msg}" }
      end
    end
  else
    puts "Failed to create DataSourceFile:"
    file.errors.full_messages.each { |msg| puts "  - #{msg}" }
  end
end
