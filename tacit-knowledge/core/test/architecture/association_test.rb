# frozen_string_literal: true

require "test_helper"

# モジュール化のデグレ防止テスト: 全モデルのアソシエーション・スコープが正常に動作することを確認。
# self.table_name設定漏れ、アソシエーション参照先の不在を検出する。
#
# 実行方法:
#   bundle exec rails test test/architecture/association_test.rb
#
class AssociationTest < ActiveSupport::TestCase
  # app/models/ 配下から動的にモデルクラス名を取得
  ALL_MODEL_CLASSES = Dir.glob(Rails.root.join("app/models/*.rb"))
    .map { |f| File.basename(f, ".rb") }
    .reject { |f| f == "application_record" }
    .map(&:camelize)
    .sort
    .freeze

  # --- アソシエーション定義の整合性テスト ---

  ALL_MODEL_CLASSES.each do |model_name|
    test "#{model_name} all associations reflect valid target classes" do
      klass = model_name.constantize
      klass.reflect_on_all_associations.each do |assoc|
        next if assoc.macro == :belongs_to && assoc.options[:polymorphic]

        if assoc.options[:through]
          through_assoc = klass.reflect_on_association(assoc.options[:through])
          assert through_assoc,
            "#{model_name}##{assoc.name}: through先 :#{assoc.options[:through]} が存在しません"
          next
        end

        begin
          target_class = assoc.klass
          assert target_class,
            "#{model_name}##{assoc.name}: ターゲットクラスが解決できません"
        rescue NameError => e
          flunk "#{model_name}##{assoc.name}: #{e.message}"
        end
      end
    end
  end

  # --- 外部キーカラム存在テスト ---

  ALL_MODEL_CLASSES.each do |model_name|
    test "#{model_name} all foreign key columns exist in table" do
      klass = model_name.constantize
      columns = klass.column_names

      klass.reflect_on_all_associations(:belongs_to).each do |assoc|
        fk = assoc.foreign_key.to_s
        assert columns.include?(fk),
          "#{model_name}##{assoc.name}: FK '#{fk}' がテーブル '#{klass.table_name}' に存在しません"

        # polymorphicの場合は_typeカラムも確認
        if assoc.options[:polymorphic]
          type_col = assoc.foreign_type.to_s
          assert columns.include?(type_col),
            "#{model_name}##{assoc.name}: polymorphic type '#{type_col}' がテーブルに存在しません"
        end
      end
    end
  end

  # --- テーブル存在テスト ---

  ALL_MODEL_CLASSES.each do |model_name|
    test "#{model_name} has a corresponding database table" do
      klass = model_name.constantize
      assert ActiveRecord::Base.connection.table_exists?(klass.table_name),
        "#{model_name}: テーブル '#{klass.table_name}' が存在しません"
    end
  end

  # --- スコープ定義テスト（全モデルから動的に検出） ---
  #
  # 引数が必要なスコープ用のダミー引数マッピング。
  # 引数なしで呼べるスコープはここに登録不要（自動テストされる）。
  SCOPE_DUMMY_ARGS = {
    "for_company" => ["dummy"],
    "in_folder" => ["dummy"],
    "for_request" => ["dummy"],
    "for_topic" => ["dummy"],
    "for_file" => ["dummy"],
    "by_type" => ["dummy"],
    "involving_request" => ["dummy"],
    "matching" => ["dummy"],
    "status_except" => ["not_started"],
    "find_by_email_or_username" => ["dummy@example.com"],
  }.freeze

  # スコープではないクラスメソッド（テスト対象外）
  NON_SCOPE_METHODS = %i[
    ransackable_attributes ransackable_associations ransackable_scopes
    ransortable_attributes
    find_or_create_for_chat find_existing_for_chat
    match_terms extract_terms
    recover_stuck_updating
    update_status
  ].to_set.freeze

  ALL_MODEL_CLASSES.each do |model_name|
    klass = model_name.constantize

    # scope マクロで定義されたメソッドのみをテスト対象にする
    defined_scopes = klass.methods(false).select { |m|
      next false if NON_SCOPE_METHODS.include?(m)
      next false if [:all, :none, :unscoped, :default_scope].include?(m)
      next false if m.to_s.start_with?("_")
      next false if m.to_s.end_with?("=")
      # enum由来のスコープは除外（enumテストで別途カバー）
      next false if klass.defined_enums.values.flat_map(&:keys).include?(m.to_s)

      begin
        method_obj = klass.method(m)
        loc = method_obj.source_location
        next false unless loc
        # モデルファイルまたはconcernファイル内で定義されたものだけ
        next false unless loc[0].include?("app/models/")
        # scope定義はlambda/procなのでarityが-1になることが多い
        # ただし通常のクラスメソッドも含まれるため、引数なしで呼んでRelationを返すか試す
        true
      rescue
        false
      end
    }

    defined_scopes.each do |scope_name|
      test "#{model_name}.#{scope_name} builds a valid query" do
        args = SCOPE_DUMMY_ARGS.fetch(scope_name.to_s, [])

        # 引数不足でエラーになる場合はスコープ定義テストとしてスキップ
        begin
          result = klass.public_send(scope_name, *args)
        rescue ArgumentError
          skip "#{model_name}.#{scope_name} requires specific arguments"
        end

        if result.is_a?(ActiveRecord::Relation)
          assert result.to_sql.present?,
            "#{model_name}.#{scope_name} should generate valid SQL"
        end
      end
    end
  end

  # --- Enum定義テスト（全モデルから動的に検出） ---

  ALL_MODEL_CLASSES.each do |model_name|
    klass = model_name.constantize
    next if klass.defined_enums.empty?

    klass.defined_enums.each_key do |enum_name|
      test "#{model_name} enum :#{enum_name} is defined with valid values" do
        values = klass.defined_enums[enum_name]
        assert values.present?,
          "#{model_name} enum :#{enum_name} should have at least one value"

        # enum値のDB上の型整合性を確認（integer or string）
        column = klass.columns_hash[enum_name]
        assert column,
          "#{model_name} enum :#{enum_name} に対応するカラムが存在しません"

        # 各enum値のインスタンスメソッド（?メソッド）が存在するか
        values.each_key do |value|
          assert klass.method_defined?("#{value}?") || klass.method_defined?("#{enum_name}_#{value}?"),
            "#{model_name}##{value}? or ##{enum_name}_#{value}? should exist"
        end
      end
    end
  end
end
