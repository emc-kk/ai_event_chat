require "test_helper"

class CompanyGlossaryTermTest < ActiveSupport::TestCase
  # === バリデーションテスト ===

  test "有効なデータで保存できる" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_a).id,
      term: "新規用語",
      definition: "新規用語の定義",
      created_by: admins(:company_a_admin),
      created_by_type: "Admin"
    )
    assert term.save
  end

  test "用語名が必須" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_a).id,
      term: nil,
      definition: "定義あり",
      created_by: admins(:company_a_admin),
      created_by_type: "Admin"
    )
    assert_not term.valid?
    assert term.errors[:term].any?
  end

  test "定義が必須" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_a).id,
      term: "用語あり",
      definition: nil,
      created_by: admins(:company_a_admin),
      created_by_type: "Admin"
    )
    assert_not term.valid?
    assert term.errors[:definition].any?
  end

  test "同一会社内で用語名がユニーク" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_a).id,
      term: "KPI報告書", # 既にフィクスチャに存在
      definition: "重複テスト",
      created_by: admins(:company_a_admin),
      created_by_type: "Admin"
    )
    assert_not term.valid?
    assert term.errors[:term].any?
  end

  test "異なる会社では同じ用語名が使える" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_b).id,
      term: "KPI報告書", # 会社Aには存在するが会社Bには存在しない
      definition: "会社Bでの定義",
      created_by: admins(:privileged_admin),
      created_by_type: "Admin"
    )
    assert term.save
  end

  test "用語名の最大文字数は255" do
    term = CompanyGlossaryTerm.new(
      company_id: companies(:company_a).id,
      term: "a" * 256,
      definition: "長い用語名テスト",
      created_by: admins(:company_a_admin),
      created_by_type: "Admin"
    )
    assert_not term.valid?
  end

  # === スコープテスト ===

  test "for_company スコープで会社別にフィルタできる" do
    terms = CompanyGlossaryTerm.for_company(companies(:company_a).id)
    assert_equal 2, terms.count
    assert terms.all? { |t| t.company_id == companies(:company_a).id }
  end

  test "ordered スコープで用語名順にソートされる" do
    terms = CompanyGlossaryTerm.for_company(companies(:company_a).id).ordered
    assert_equal "KPI報告書", terms.first.term
    assert_equal "OKR会議", terms.last.term
  end

  # === match_terms テスト ===

  test "match_terms: テキストに含まれる用語を返す" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_a).id, "KPI報告書の提出期限")
    assert_equal 1, results.size
    assert_equal "KPI報告書", results.first.term
  end

  test "match_terms: 複数の用語がマッチする" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_a).id, "KPI報告書をOKR会議で確認")
    assert_equal 2, results.size
  end

  test "match_terms: マッチしない場合は空配列" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_a).id, "関係ない文章")
    assert_empty results
  end

  test "match_terms: company_idがnilの場合は空配列" do
    results = CompanyGlossaryTerm.match_terms(nil, "KPI報告書")
    assert_empty results
  end

  test "match_terms: テキストが空の場合は空配列" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_a).id, "")
    assert_empty results
  end

  test "match_terms: テキストがnilの場合は空配列" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_a).id, nil)
    assert_empty results
  end

  test "match_terms: 他社の用語はマッチしない" do
    results = CompanyGlossaryTerm.match_terms(companies(:company_b).id, "KPI報告書の提出")
    assert_empty results
  end

  # === アソシエーションテスト ===

  test "companyアソシエーションが正しい" do
    term = company_glossary_terms(:term_kpi)
    assert_equal companies(:company_a), term.company
  end

  test "created_byポリモーフィックアソシエーションが正しい" do
    term = company_glossary_terms(:term_kpi)
    assert_equal admins(:company_a_admin), term.created_by
  end
end
