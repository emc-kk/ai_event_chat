# Create sample companies
companies_data = [
  { name: "株式会社サンプル", description: "サンプル会社1" },
  { name: "テスト株式会社", description: "サンプル会社2" }
]

companies_data.each_with_index do |data, i|
  company = Company.find_or_initialize_by(name: data[:name])
  company.description = data[:description]
  company.status = :active

  if company.save
    puts "Company #{i + 1} created successfully!"
    puts "  ID: #{company.id}"
    puts "  Name: #{company.name}"
  else
    puts "Failed to create company #{i + 1}:"
    company.errors.full_messages.each { |msg| puts "  - #{msg}" }
  end
end
