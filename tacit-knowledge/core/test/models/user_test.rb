require "test_helper"

class UserTest < ActiveSupport::TestCase
  # === authenticate テスト ===

  test "authenticate: 正しいパスワードでtrueを返す" do
    user = users(:company_a_user_admin)
    assert user.authenticate("Test1234!")
  end

  test "authenticate: 間違ったパスワードでfalseを返す" do
    user = users(:company_a_user_admin)
    assert_not user.authenticate("WrongPassword1!")
  end

  test "authenticate: password_digestが空の場合falseを返す" do
    user = User.new(password_digest: nil)
    assert_not user.authenticate("Test1234!")
  end

  # === get_session_token / set_session_token テスト ===

  test "get_session_token: 既存トークンがあればそのまま返す" do
    user = users(:company_a_user_admin)
    assert_equal "test_session_user_admin_a", user.get_session_token
  end

  test "get_session_token: トークンが空なら新規生成して返す" do
    user = users(:company_a_user_admin)
    user.update_column(:session_token, nil)
    token = user.get_session_token
    assert_not_nil token
    assert_equal 32, token.length
  end

  test "set_session_token: トークンを更新する" do
    user = users(:company_a_user_admin)
    old_token = user.session_token
    user.set_session_token
    assert_not_equal old_token, user.session_token
    assert_equal 32, user.session_token.length
  end

  # === privileged? テスト ===

  test "privileged?: company_idがnilならtrue" do
    user = User.new(company_id: nil)
    assert user.privileged?
  end

  test "privileged?: company_idがあればfalse" do
    user = users(:company_a_user_admin)
    assert_not user.privileged?
  end
end
