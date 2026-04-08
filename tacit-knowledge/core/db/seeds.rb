# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

# デモモード用シードデータ
if ENV['DEMO_MODE'] == 'true'
  puts "=== デモモード: シードデータを作成中 ==="

  # 1. デモ用会社
  company = Company.find_or_create_by!(name: 'デモ会社') do |c|
    c.status = :active
  end
  puts "  会社: #{company.name} (#{company.id})"

  # 2. デモ用管理者（Userのcreatorとして必要）
  admin = Admin.find_or_create_by!(email: 'demo-admin@example.com') do |a|
    a.name = 'デモ管理者'
    a.company = company
    a.password = 'Demo1234!'
    a.password_confirmation = 'Demo1234!'
    a.password_change_required = true
    a.confirmed_at = Time.current
  end
  puts "  管理者: #{admin.name} (#{admin.email})"

  # 3. デモ用ユーザー（自動ログインに使用）
  demo_user = User.find_or_create_by!(email: 'demo@example.com') do |u|
    u.name = 'デモユーザー'
    u.company = company
    u.role = :company_admin
    u.password = 'Demo1234!'
    u.password_confirmation = 'Demo1234!'
    u.password_change_required = true
    u.creator = admin
    u.confirmed_at = Time.current
  end
  puts "  ユーザー: #{demo_user.name} (#{demo_user.email})"

  puts "=== デモモード: シードデータ作成完了 ==="
end
