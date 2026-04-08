# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: 全モデルクラスがロードできることを確認。
# ファイル移動でRailsのautoloadパスが変わった場合に検出する。
#
# 実行方法:
#   bundle exec rails test test/architecture/model_load_test.rb
#
class ModelLoadTest < ActiveSupport::TestCase
  # app/models/ 配下から動的にモデルクラス名を取得
  ALL_MODELS = Dir.glob(Rails.root.join("app/models/*.rb"))
    .map { |f| File.basename(f, ".rb") }
    .reject { |f| f == "application_record" }
    .map(&:camelize)
    .sort
    .freeze

  ALL_MODELS.each do |model_name|
    test "#{model_name} can be loaded and is an ApplicationRecord subclass" do
      klass = model_name.constantize
      assert klass < ApplicationRecord, "#{model_name} should inherit from ApplicationRecord"
      assert_equal model_name, klass.name
    end
  end

  test "at least one model exists in app/models/" do
    assert ALL_MODELS.size > 0, "app/models/ にモデルファイルが見つかりません"
  end
end
