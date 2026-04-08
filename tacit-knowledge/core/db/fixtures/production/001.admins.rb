# Create privileged admin (company_id = nil)
# Password should be set via environment variable for security
admin_email = ENV.fetch("ADMIN_EMAIL", "admin@skillrelay.ai")
admin_password = ENV.fetch("ADMIN_PASSWORD") { raise "ADMIN_PASSWORD environment variable is required" }

admin = Admin.find_or_initialize_by(email: admin_email)
admin.assign_attributes(
  password: admin_password,
  password_confirmation: admin_password,
  name: "システム管理者",
  company_id: nil,
  confirmed_at: Time.current
)

if admin.save
  puts "Privileged Admin created successfully!"
  puts "  ID: #{admin.id}"
  puts "  Email: #{admin.email}"
  puts "  Name: #{admin.name}"
  puts "  Company: 特権 (nil)"
else
  puts "Failed to create privileged admin:"
  admin.errors.full_messages.each { |msg| puts "  - #{msg}" }
end

# Preview environment: also create admin@example.com for consistency with local dev
if ENV["PREVIEW_ENV"].present? && admin_email != "admin@example.com"
  dev_admin = Admin.find_or_initialize_by(email: "admin@example.com")
  dev_admin.assign_attributes(
    password: "Password1!",
    password_confirmation: "Password1!",
    name: "特権管理者",
    company_id: nil,
    confirmed_at: Time.current
  )

  if dev_admin.save
    puts "Preview Dev Admin created: admin@example.com"
  else
    puts "Failed to create preview dev admin: #{dev_admin.errors.full_messages.join(', ')}"
  end
end
