# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: 全GETエンドポイントにリクエストして500エラーが発生しないことを確認。
# コントローラー/ビュー/ヘルパーの参照が壊れた場合に検出する。
#
# 実行方法:
#   bundle exec rails test test/architecture/smoke_test.rb
#
class SmokeTest < ActionDispatch::IntegrationTest
  # 認証不要なパス（ログイン画面など）
  UNAUTHENTICATED_PATHS = %w[/login].freeze

  # パラメータ付きルートでスキップするもの（:idが必要だがfixtureがないなど）
  SKIP_PATTERNS = [
    %r{/rails/},        # Rails内部ルート
    %r{/cable},         # ActionCable
    %r{:.*_id.*:id},    # ネストが深すぎるルート（個別テストで対応）
  ].freeze

  # アセットパイプライン未ビルドによる500はモジュール化のデグレではないので除外
  ASSET_ERROR_PATTERNS = [
    /is not present in the asset pipeline/,
    /Asset .* was not declared to be precompiled/,
  ].freeze

  def login_as_admin
    post login_path, params: { session: { account: "privileged@test.com", password: "Test1234!" } }
  end

  def asset_pipeline_error?(err)
    ASSET_ERROR_PATTERNS.any? { |pat| err.message.match?(pat) }
  end

  # --- 動的にGETルートを収集してテスト生成 ---

  GET_ROUTES = Rails.application.routes.routes
    .select { |r| r.verb == "GET" && !r.internal }
    .reject { |r| SKIP_PATTERNS.any? { |pat| r.path.spec.to_s.match?(pat) } }
    .map { |r|
      {
        name: "#{r.defaults[:controller]}##{r.defaults[:action]}",
        path: r.path.spec.to_s.gsub("(.:format)", ""),
        has_params: r.path.spec.to_s.include?(":"),
        controller: r.defaults[:controller],
        action: r.defaults[:action],
      }
    }
    .reject { |r| r[:controller].blank? }
    .uniq { |r| r[:name] }
    .freeze

  # パラメータなしのルート（index, new等）はそのままアクセス
  GET_ROUTES.reject { |r| r[:has_params] }.each do |route|
    test "GET #{route[:name]} does not return 500" do
      login_as_admin
      begin
        get route[:path]
        refute_equal 500, response.status,
          "#{route[:name]} returned 500 Internal Server Error"
      rescue ActionView::Template::Error => e
        skip("Asset pipeline error: #{e.message}") if asset_pipeline_error?(e)
        raise
      end
    end
  end

  # パラメータありのルートはアクセスして500でないことだけ確認
  # （404はリソースが無いだけなのでOK、302はリダイレクトでOK）
  GET_ROUTES.select { |r| r[:has_params] }.each do |route|
    test "GET #{route[:name]} controller/view loads without 500" do
      login_as_admin
      # ダミーIDでアクセス（リソースが無ければ404になるはず。500なら参照エラー）
      path = route[:path].gsub(/:(\w+)/, 'nonexistent_id')
      begin
        get path
        refute_equal 500, response.status,
          "#{route[:name]} returned 500 Internal Server Error (path: #{path})"
      rescue ActionView::Template::Error => e
        skip("Asset pipeline error: #{e.message}") if asset_pipeline_error?(e)
        raise
      end
    end
  end

  test "GET route count sanity check" do
    assert GET_ROUTES.size >= 10,
      "GETルートが少なすぎます (#{GET_ROUTES.size})。ルート収集ロジックに問題がある可能性。"
  end
end
