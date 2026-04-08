require "test_helper"

class PermissionTest < ActiveSupport::TestCase
  # === grantee_belongs_to_same_company テスト ===

  test "grantee_belongs_to_same_company: 同一企業のユーザーはvalid" do
    perm = Permission.new(
      company_id: companies(:company_a).id,
      permissible_type: "TopicFolder",
      permissible_id: topic_folders(:company_a_folder).id,
      grantee_type: "User",
      grantee_id: users(:company_a_no_perm).id,
      role: :viewer
    )
    assert perm.valid?
  end

  test "grantee_belongs_to_same_company: 別企業のユーザーはinvalid" do
    perm = Permission.new(
      company_id: companies(:company_a).id,
      permissible_type: "TopicFolder",
      permissible_id: topic_folders(:company_a_folder).id,
      grantee_type: "User",
      grantee_id: users(:company_b_user).id,
      role: :viewer
    )
    assert_not perm.valid?
    assert perm.errors[:grantee_id].any?
  end

  test "grantee_belongs_to_same_company: 特権管理者(company_id=nil)はどの企業でもvalid" do
    perm = Permission.new(
      company_id: companies(:company_a).id,
      permissible_type: "TopicFolder",
      permissible_id: topic_folders(:company_a_folder).id,
      grantee_type: "Admin",
      grantee_id: admins(:privileged_admin).id,
      role: :owner
    )
    assert perm.valid?
  end

  test "grantee_belongs_to_same_company: 存在しないgranteeはinvalid" do
    perm = Permission.new(
      company_id: companies(:company_a).id,
      permissible_type: "TopicFolder",
      permissible_id: topic_folders(:company_a_folder).id,
      grantee_type: "User",
      grantee_id: "nonexistent_id",
      role: :viewer
    )
    assert_not perm.valid?
    assert perm.errors[:grantee_id].any?
  end
end
