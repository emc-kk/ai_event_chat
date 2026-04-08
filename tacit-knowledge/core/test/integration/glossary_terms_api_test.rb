require "test_helper"

class GlossaryTermsApiTest < ActionDispatch::IntegrationTest
  # === ヘルパーメソッド ===

  def login_as_admin(admin)
    post login_path, params: { session: { account: admin.email, password: "Test1234!" } }
    assert_response :redirect, "Admin login failed for #{admin.email}"
  end

  def login_as_user(user)
    post login_path, params: { session: { account: user.email, password: "Test1234!" } }
    assert_response :redirect, "User login failed for #{user.email}"
  end

  def json_response
    JSON.parse(response.body)
  end

  # ============================================
  # CRUD テスト — 企業管理者（Admin with company_id）
  # ============================================

  test "企業管理者: GET /api/glossary_terms で会社Aの用語一覧を取得" do
    login_as_admin(admins(:company_a_admin))

    get api_glossary_terms_path, as: :json
    assert_response :success

    terms = json_response.map { |t| t["term"] }
    assert_equal 2, json_response.size
    assert_includes terms, "KPI報告書"
    assert_includes terms, "OKR会議"
  end

  test "企業管理者: POST /api/glossary_terms で新しい用語を作成" do
    login_as_admin(admins(:company_a_admin))

    assert_difference "CompanyGlossaryTerm.count", 1 do
      post api_glossary_terms_path,
        params: { glossary_term: { term: "SLA", definition: "サービスレベルアグリーメント" } },
        as: :json
    end

    assert_response :created
    assert_equal "SLA", json_response["term"]
    assert_equal "サービスレベルアグリーメント", json_response["definition"]
    assert_equal "Admin", json_response["created_by_type"]
  end

  test "企業管理者: PATCH /api/glossary_terms/:id で用語を更新" do
    login_as_admin(admins(:company_a_admin))
    term = company_glossary_terms(:term_kpi)

    patch api_glossary_term_path(term),
      params: { glossary_term: { definition: "更新後の定義" } },
      as: :json

    assert_response :success
    assert_equal "更新後の定義", json_response["definition"]
    assert_equal "KPI報告書", json_response["term"]
  end

  test "企業管理者: DELETE /api/glossary_terms/:id で用語を削除" do
    login_as_admin(admins(:company_a_admin))
    term = company_glossary_terms(:term_kpi)

    assert_difference "CompanyGlossaryTerm.count", -1 do
      delete api_glossary_term_path(term), as: :json
    end

    assert_response :no_content
  end

  # ============================================
  # CRUD テスト — company_admin User
  # ============================================

  test "company_admin User: 用語の作成が可能" do
    login_as_user(users(:company_a_user_admin))

    assert_difference "CompanyGlossaryTerm.count", 1 do
      post api_glossary_terms_path,
        params: { glossary_term: { term: "MTG", definition: "ミーティング" } },
        as: :json
    end

    assert_response :created
    assert_equal "MTG", json_response["term"]
    assert_equal "User", json_response["created_by_type"]
  end

  # ============================================
  # バリデーションテスト
  # ============================================

  test "用語名が空の場合は422を返す" do
    login_as_admin(admins(:company_a_admin))

    post api_glossary_terms_path,
      params: { glossary_term: { term: "", definition: "何かの定義" } },
      as: :json

    assert_response :unprocessable_entity
    assert json_response["errors"].any? { |e| e.include?("Term") || e.include?("用語") }
  end

  test "定義が空の場合は422を返す" do
    login_as_admin(admins(:company_a_admin))

    post api_glossary_terms_path,
      params: { glossary_term: { term: "テスト用語", definition: "" } },
      as: :json

    assert_response :unprocessable_entity
  end

  test "重複する用語名は422を返す" do
    login_as_admin(admins(:company_a_admin))

    post api_glossary_terms_path,
      params: { glossary_term: { term: "KPI報告書", definition: "重複テスト" } },
      as: :json

    assert_response :unprocessable_entity
    assert json_response["errors"].any? { |e| e.include?("登録") || e.include?("taken") }
  end

  # ============================================
  # 権限テスト — editor権限User
  # ============================================

  test "editor権限User: 用語の作成が可能" do
    login_as_user(users(:company_a_editor))

    assert_difference "CompanyGlossaryTerm.count", 1 do
      post api_glossary_terms_path,
        params: { glossary_term: { term: "NDA", definition: "秘密保持契約" } },
        as: :json
    end

    assert_response :created
  end

  test "editor権限User: 用語の更新が可能" do
    login_as_user(users(:company_a_editor))
    term = company_glossary_terms(:term_kpi)

    patch api_glossary_term_path(term),
      params: { glossary_term: { definition: "editor更新テスト" } },
      as: :json

    assert_response :success
  end

  test "editor権限User: 用語の削除が可能" do
    login_as_user(users(:company_a_editor))
    term = company_glossary_terms(:term_okr)

    assert_difference "CompanyGlossaryTerm.count", -1 do
      delete api_glossary_term_path(term), as: :json
    end

    assert_response :no_content
  end

  # ============================================
  # 権限テスト — viewer権限User（編集不可）
  # ============================================

  test "viewer権限User: 用語一覧の取得が可能" do
    login_as_user(users(:company_a_viewer))

    get api_glossary_terms_path, as: :json
    assert_response :success
    assert_equal 2, json_response.size
  end

  test "viewer権限User: 用語の作成は403" do
    login_as_user(users(:company_a_viewer))

    assert_no_difference "CompanyGlossaryTerm.count" do
      post api_glossary_terms_path,
        params: { glossary_term: { term: "テスト", definition: "テスト" } },
        as: :json
    end

    assert_response :forbidden
  end

  test "viewer権限User: 用語の更新は403" do
    login_as_user(users(:company_a_viewer))
    term = company_glossary_terms(:term_kpi)

    patch api_glossary_term_path(term),
      params: { glossary_term: { definition: "不正更新" } },
      as: :json

    assert_response :forbidden
  end

  test "viewer権限User: 用語の削除は403" do
    login_as_user(users(:company_a_viewer))
    term = company_glossary_terms(:term_kpi)

    assert_no_difference "CompanyGlossaryTerm.count" do
      delete api_glossary_term_path(term), as: :json
    end

    assert_response :forbidden
  end

  # ============================================
  # 権限テスト — 権限なしUser
  # ============================================

  test "権限なしUser: 用語の作成は403" do
    login_as_user(users(:company_a_no_perm))

    assert_no_difference "CompanyGlossaryTerm.count" do
      post api_glossary_terms_path,
        params: { glossary_term: { term: "テスト", definition: "テスト" } },
        as: :json
    end

    assert_response :forbidden
  end

  # ============================================
  # 権限テスト — 特権管理者（company_id=nil）
  # ============================================

  test "特権管理者: company_idがnilのため403を返す" do
    login_as_admin(admins(:privileged_admin))

    get api_glossary_terms_path, as: :json

    assert_response :forbidden
    assert_equal "会社コンテキストが必要です", json_response["error"]
  end

  # ============================================
  # クロスカンパニーテスト
  # ============================================

  test "会社Bユーザーは会社Aの用語を取得できない" do
    login_as_user(users(:company_b_user))

    get api_glossary_terms_path, as: :json
    assert_response :success

    # 会社Bの用語のみ取得される（会社Aの用語は含まれない）
    assert json_response.none? { |t| t["term"] == "KPI報告書" }
    assert json_response.none? { |t| t["term"] == "OKR会議" }
  end

  test "会社Bユーザーは会社Aの用語を更新できない" do
    login_as_user(users(:company_b_user))
    term = company_glossary_terms(:term_kpi) # 会社Aの用語

    patch api_glossary_term_path(term),
      params: { glossary_term: { definition: "不正アクセス" } },
      as: :json

    assert_response :not_found
  end

  test "会社Bユーザーは会社Aの用語を削除できない" do
    login_as_user(users(:company_b_user))
    term = company_glossary_terms(:term_kpi) # 会社Aの用語

    assert_no_difference "CompanyGlossaryTerm.count" do
      delete api_glossary_term_path(term), as: :json
    end

    assert_response :not_found
  end

  # ============================================
  # match API テスト
  # ============================================

  test "match API: テキストに含まれる用語がマッチする" do
    login_as_admin(admins(:company_a_admin))

    get match_api_glossary_terms_path, params: { q: "KPI報告書の提出期限について" }, as: :json

    assert_response :success
    assert_equal 1, json_response.size
    assert_equal "KPI報告書", json_response[0]["term"]
    assert_equal "毎月の業績指標をまとめた報告書", json_response[0]["definition"]
  end

  test "match API: 複数の用語がマッチする" do
    login_as_admin(admins(:company_a_admin))

    get match_api_glossary_terms_path, params: { q: "KPI報告書をOKR会議で共有する" }, as: :json

    assert_response :success
    assert_equal 2, json_response.size
    terms = json_response.map { |t| t["term"] }
    assert_includes terms, "KPI報告書"
    assert_includes terms, "OKR会議"
  end

  test "match API: マッチしない場合は空配列を返す" do
    login_as_admin(admins(:company_a_admin))

    get match_api_glossary_terms_path, params: { q: "関係ないテキスト" }, as: :json

    assert_response :success
    assert_equal [], json_response
  end

  test "match API: クエリが空の場合は空配列を返す" do
    login_as_admin(admins(:company_a_admin))

    get match_api_glossary_terms_path, params: { q: "" }, as: :json

    assert_response :success
    assert_equal [], json_response
  end

  test "match API: 他社の用語はマッチしない" do
    login_as_user(users(:company_b_user))

    get match_api_glossary_terms_path, params: { q: "KPI報告書の提出" }, as: :json

    assert_response :success
    assert_equal [], json_response
  end

  # ============================================
  # 未認証テスト
  # ============================================

  test "未認証ユーザーはAPIにアクセスできない" do
    get api_glossary_terms_path, as: :json

    # ログインページへリダイレクトまたは401
    assert [302, 401].include?(response.status), "Expected redirect or unauthorized, got #{response.status}"
  end
end
