# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: 全ルーティングが有効なコントローラーにマッピングされていることを確認。
# コントローラーのnamespace変更でルーティングが断絶した場合に検出する。
#
# 実行方法:
#   bundle exec rails test test/architecture/routing_test.rb
#
class RoutingTest < ActiveSupport::TestCase
  test "all routes map to existing controller actions" do
    missing = []

    Rails.application.routes.routes.each do |route|
      # 内部ルート（Rails::HealthController等）はスキップ
      next if route.internal
      defaults = route.defaults
      next if defaults.empty?

      controller = defaults[:controller]
      action = defaults[:action]
      next if controller.blank? || action.blank?

      # コントローラークラスがロードできるか確認
      controller_class_name = "#{controller.camelize}Controller"
      begin
        klass = controller_class_name.constantize
        unless klass.instance_methods.include?(action.to_sym) || klass.method_defined?(action.to_sym)
          missing << "#{controller}##{action} (action not defined on #{controller_class_name})"
        end
      rescue NameError
        missing << "#{controller}##{action} (controller #{controller_class_name} not found)"
      end
    end

    assert missing.empty?,
      "以下のルーティングが無効です:\n#{missing.map { |m| "  - #{m}" }.join("\n")}"
  end

  test "total route count has not decreased" do
    route_count = Rails.application.routes.routes.reject(&:internal).size
    # 現在のルート数をベースラインとして記録。減少した場合はルート削除の意図を確認する。
    assert route_count >= 50,
      "ルート数が想定より少ない (#{route_count})。ルーティング断絶の可能性あり。"
  end
end
