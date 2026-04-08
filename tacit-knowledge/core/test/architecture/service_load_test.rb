# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: Job/Service/Mailerクラスが全てロードできることを確認。
# ファイル移動でRailsのautoloadパスが変わった場合に検出する。
#
# 実行方法:
#   bundle exec rails test test/architecture/service_load_test.rb
#
class ServiceLoadTest < ActiveSupport::TestCase
  # --- Job ---
  JOB_FILES = Dir.glob(Rails.root.join("app/jobs/**/*.rb"))
    .map { |f| f.sub(%r{.*/app/jobs/}, "").sub(/\.rb$/, "").camelize }
    .reject { |name| name == "ApplicationJob" }
    .sort
    .freeze

  JOB_FILES.each do |class_name|
    test "Job #{class_name} can be loaded" do
      klass = class_name.constantize
      assert klass < ApplicationJob || klass == ApplicationJob,
        "#{class_name} should be a Job class"
    end
  end

  # --- Service ---
  SERVICE_FILES = Dir.glob(Rails.root.join("app/services/**/*.rb"))
    .map { |f| f.sub(%r{.*/app/services/}, "").sub(/\.rb$/, "").camelize }
    .sort
    .freeze

  SERVICE_FILES.each do |class_name|
    test "Service #{class_name} can be loaded" do
      klass = class_name.constantize
      assert klass.is_a?(Class) || klass.is_a?(Module),
        "#{class_name} should be a valid class or module"
    end
  end

  # --- Mailer ---
  MAILER_FILES = Dir.glob(Rails.root.join("app/mailers/**/*.rb"))
    .map { |f| f.sub(%r{.*/app/mailers/}, "").sub(/\.rb$/, "").camelize }
    .reject { |name| name == "ApplicationMailer" }
    .sort
    .freeze

  MAILER_FILES.each do |class_name|
    test "Mailer #{class_name} can be loaded" do
      klass = class_name.constantize
      assert klass < ApplicationMailer || klass == ApplicationMailer,
        "#{class_name} should inherit from ApplicationMailer"
    end
  end

  test "at least one service exists" do
    total = JOB_FILES.size + SERVICE_FILES.size + MAILER_FILES.size
    assert total > 0, "Job/Service/Mailer がひとつも見つかりません"
  end
end
