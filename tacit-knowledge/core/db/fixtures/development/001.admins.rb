# Create privileged admin (company_id = nil)
privileged_admin = Admin.find_or_initialize_by(email: "admin@example.com")
privileged_admin.assign_attributes(
  password: "Password1!",
  password_confirmation: "Password1!",
  name: "特権管理者",
  company_id: nil,
  confirmed_at: Time.current
)

if privileged_admin.save
  puts "Privileged Admin created successfully!"
  puts "  ID: #{privileged_admin.id}"
  puts "  Email: #{privileged_admin.email}"
  puts "  Name: #{privileged_admin.name}"
  puts "  Company: 特権 (nil)"
else
  puts "Failed to create privileged admin:"
  privileged_admin.errors.full_messages.each { |msg| puts "  - #{msg}" }
end
