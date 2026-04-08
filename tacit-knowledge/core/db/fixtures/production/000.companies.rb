# Create sample companies for preview environments
# Only runs when PREVIEW_ENV is set (preview env)
if ENV["PREVIEW_ENV"].present?
  companies_data = [
    { name: "株式会社サンプル", description: "サンプル会社1" },
    { name: "テスト株式会社", description: "サンプル会社2" }
  ]

  companies_data.each_with_index do |data, i|
    company = Company.find_or_initialize_by(name: data[:name])
    company.description = data[:description]
    company.status = :active

    if company.save
      puts "Company #{i + 1} created: #{company.name} (ID: #{company.id})"
    else
      puts "Failed to create company #{i + 1}: #{company.errors.full_messages.join(', ')}"
    end
  end
else
  puts "Skipping preview companies seed (not a preview environment)"
end
