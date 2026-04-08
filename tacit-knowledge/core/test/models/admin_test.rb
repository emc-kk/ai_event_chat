require "test_helper"

class AdminTest < ActiveSupport::TestCase
  # === authenticate テスト ===

  test "authenticate: 正しいパスワードでtrueを返す" do
    admin = admins(:company_a_admin)
    assert admin.authenticate("Test1234!")
  end

  test "authenticate: 間違ったパスワードでfalseを返す" do
    admin = admins(:company_a_admin)
    assert_not admin.authenticate("WrongPassword1!")
  end

  test "authenticate: password_digestが空の場合falseを返す" do
    admin = Admin.new(password_digest: nil)
    assert_not admin.authenticate("Test1234!")
  end

  # === get_session_token / set_session_token テスト ===

  test "get_session_token: 既存トークンがあればそのまま返す" do
    admin = admins(:company_a_admin)
    assert_equal "test_session_comp_a_admin", admin.get_session_token
  end

  test "get_session_token: トークンが空なら新規生成して返す" do
    admin = admins(:company_a_admin)
    admin.update_column(:session_token, nil)
    token = admin.get_session_token
    assert_not_nil token
    assert_equal 32, token.length # hex(16) = 32文字
  end

  test "set_session_token: トークンを更新する" do
    admin = admins(:company_a_admin)
    old_token = admin.session_token
    admin.set_session_token
    assert_not_equal old_token, admin.session_token
    assert_equal 32, admin.session_token.length
  end

  # === privileged? テスト ===

  test "privileged?: company_idがnilならtrue" do
    admin = admins(:privileged_admin)
    assert admin.privileged?
  end

  test "privileged?: company_idがあればfalse" do
    admin = admins(:company_a_admin)
    assert_not admin.privileged?
  end
end
