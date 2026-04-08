# frozen_string_literal: true

require "test_helper"

# コントローラーで company_id スコープが適用されていないクエリを検出するアーキテクチャテスト。
#
# マルチテナントアプリケーションとして、company_id カラムを持つモデルへのアクセスには
# 必ず for_company スコープまたは同等のフィルタリングが必要。
# このテストは CI で自動実行され、スコープ漏れを防止する。
#
# 実行方法:
#   bundle exec rails test test/architecture/company_scope_test.rb
#
class CompanyScopeTest < ActiveSupport::TestCase
  # company_id カラムを持つモデルを動的に検出
  COMPANY_SCOPED_MODELS = Dir.glob(Rails.root.join("app/models/*.rb"))
    .map { |f| File.basename(f, ".rb").camelize }
    .reject { |name| name == "ApplicationRecord" }
    .select { |name|
      klass = name.constantize
      klass < ApplicationRecord &&
        klass.column_names.include?("company_id")
    }
    .sort
    .freeze

  # 検出対象の ActiveRecord クエリメソッド
  QUERY_METHODS = %w[
    find find_by where all pluck first last count exists?
  ].freeze

  # 免除コントローラー（理由付き Hash）
  EXEMPT_CONTROLLERS = {
    "sessions_controller.rb"            => "認証エンドポイント（email/token で検索）",
    "confirmations_controller.rb"       => "メール確認エンドポイント",
    "application_controller.rb"         => "フレームワーク基底クラス",
    "topics/application_controller.rb"  => "空の名前空間コンテナ",
    "companies_controller.rb"           => "privileged_admin_required で完全制限済み",
    "api/scraper_admin_controller.rb"   => "privileged_admin_required で完全制限済み（企業横断ダッシュボード）",
  }.freeze

  # 免除ディレクトリ（コントローラー本体ではない）
  EXEMPT_DIRECTORIES = %w[concerns dev].freeze

  # 個別許可リスト（"相対パス:Model" => "理由"）
  ALLOWLISTED_USAGES = {
    "requests_controller.rb:Topic" =>
      "admin_required ガード + topics_for_current_user 内の privileged_admin? 分岐で保護",
    "rooms_controller.rb:Topic" =>
      "TopicAccessControl concern (require_parent_viewer/require_room_viewer) で権限ベースのアクセス制御",
    "topics/manuals_controller.rb:Topic" =>
      "TopicAccessControl concern (require_topic_viewer/editor) で権限ベースのアクセス制御",
    "topics/comparison_sessions_controller.rb:Topic" =>
      "TopicAccessControl concern (require_topic_viewer/editor) で権限ベースのアクセス制御",
    "topic_folders_controller.rb:TopicFolder" =>
      "descendant_ids: folder_scope 済みの @folder の子孫探索のみ（同一 company 内のツリー走査）",
    "permissions_controller.rb:Admin" =>
      "privileged_admin? ガード付き elsif ブロック内（company_id がない特権管理者作成リソース用）",
    "permissions_controller.rb:User" =>
      "privileged_admin? ガード付き elsif ブロック内（company_id がない特権管理者作成リソース用）",
    "permissions_controller.rb:UserGroup" =>
      "privileged_admin? ガード付き elsif ブロック内（company_id がない特権管理者作成リソース用）",
    "api/data_acquisition_jobs_controller.rb:DataAcquisitionJob" =>
      "admin_required + index は privileged_admin? 分岐で for_company 適用済み、set_job は admin_required ガードで保護",
    "api/data_acquisition_jobs_controller.rb:DataAcquisitionRecord" =>
      "admin_required ガード + ジョブ内レコード数カウントのみ（job_id 経由の間接スコープ）",
    "api/data_acquisition_records_controller.rb:DataAcquisitionJob" =>
      "admin_required ガード + scoped_records 内で privileged_admin? 分岐による for_company 適用済み",
    "api/data_acquisition_records_controller.rb:DataAcquisitionRecord" =>
      "admin_required ガード + scoped_records メソッド内で privileged_admin? 分岐による for_company 適用済み",
    "api/glossary_terms_controller.rb:CompanyGlossaryTerm" =>
      "require_company_context ガード + 全クエリに company_id: current_company_id を直接指定",
  }.freeze

  test "all controllers properly scope queries on company_id models" do
    controllers_dir = Rails.root.join("app", "controllers")
    violations = []

    controller_files(controllers_dir).each do |file_path|
      relative_path = file_path.relative_path_from(controllers_dir).to_s
      next if exempt?(relative_path)

      lines = File.readlines(file_path)
      scope_ranges = detect_scope_method_ranges(lines)

      lines.each_with_index do |line, index|
        stripped = line.strip

        # コメント行はスキップ
        next if stripped.start_with?("#")
        # _scope / scoped_find メソッド内はスキップ
        next if inside_scope_range?(index, scope_ranges)

        COMPANY_SCOPED_MODELS.each do |model|
          next unless line_has_model_query?(line, model)
          next if safe_on_same_line?(line)
          next if safe_multiline_where?(lines, index, model)
          next if allowlisted?(relative_path, model)

          violations << {
            file: relative_path,
            line_number: index + 1,
            model: model,
            code: stripped
          }
        end
      end
    end

    assert violations.empty?, violation_message(violations)
  end

  private

  # controllers ディレクトリ配下の全コントローラーファイルを取得
  def controller_files(dir)
    Dir.glob(dir.join("**", "*_controller.rb")).map { |f| Pathname.new(f) }.sort
  end

  # 免除対象か判定
  def exempt?(relative_path)
    return true if EXEMPT_DIRECTORIES.any? { |d| relative_path.start_with?("#{d}/") }
    EXEMPT_CONTROLLERS.key?(relative_path)
  end

  # _scope メソッドおよび scoped_find メソッドの行範囲を検出
  def detect_scope_method_ranges(lines)
    ranges = []
    lines.each_with_index do |line, index|
      if line =~ /^(\s*)def\s+(\w+_scope|scoped_find)\b/
        method_indent = $1.length
        end_index = find_method_end(lines, index + 1, method_indent)
        ranges << (index..end_index) if end_index
      end
    end
    ranges
  end

  # 同じインデントレベルの end を探してメソッド終端を特定
  def find_method_end(lines, start, indent_level)
    (start...lines.length).each do |i|
      if lines[i] =~ /^(\s*)end\b/ && $1.length == indent_level
        return i
      end
    end
    nil
  end

  def inside_scope_range?(index, ranges)
    ranges.any? { |r| r.include?(index) }
  end

  # 行が対象モデルのクエリメソッド呼び出しを含むか
  def line_has_model_query?(line, model)
    line.match?(model_query_regex(model))
  end

  def model_query_regex(model)
    @model_query_regexes ||= {}
    @model_query_regexes[model] ||= begin
      methods_pattern = QUERY_METHODS.map { |m|
        escaped = Regexp.escape(m)
        m.end_with?("?") ? escaped : "#{escaped}\\b"
      }.join("|")
      /\b#{model}\.(#{methods_pattern})/
    end
  end

  # 同一行の安全パターンを検出
  def safe_on_same_line?(line)
    return true if line.include?(".for_company(")
    return true if line.include?("privileged_admin?")
    return true if line.match?(/\.where\(.*company_id:/)
    return true if line.match?(/\.(new|create|create!|build)\b/)
    false
  end

  # 複数行にまたがる where(company_id: ...) を検出
  def safe_multiline_where?(lines, index, model)
    line = lines[index]
    return false unless line.match?(/\b#{model}\.where\s*\(/)
    # 同一行で閉じている場合は対象外（safe_on_same_line? で処理済み）
    return false if line.count("(") <= line.count(")")

    # 閉じ括弧まで先読みして company_id: を探す
    open_count = line.count("(") - line.count(")")
    lookahead_limit = [10, lines.length - index - 1].min
    (1..lookahead_limit).each do |offset|
      next_line = lines[index + offset].to_s
      return true if next_line.match?(/company_id:/)
      open_count += next_line.count("(") - next_line.count(")")
      break if open_count <= 0
    end
    false
  end

  # 許可リストに含まれるか
  def allowlisted?(relative_path, model)
    ALLOWLISTED_USAGES.key?("#{relative_path}:#{model}")
  end

  # 違反レポートを生成
  def violation_message(violations)
    return "" if violations.empty?

    msg = +"\n\ncompany_id スコープが適用されていないクエリを #{violations.size} 件検出しました:\n\n"
    violations.each do |v|
      msg << "  #{v[:file]}:#{v[:line_number]} [#{v[:model]}]\n"
      msg << "    #{v[:code]}\n\n"
    end
    msg << <<~HELP
      修正方法:
        1. for_company(current_company_id) スコープを適用する
        2. _scope メソッド内で privileged_admin? ガード付きで使用する
        3. 正当な例外の場合は ALLOWLISTED_USAGES に理由付きで追加する
    HELP
    msg
  end
end
