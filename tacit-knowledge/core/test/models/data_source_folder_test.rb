require "test_helper"

class DataSourceFolderTest < ActiveSupport::TestCase
  setup do
    @company = companies(:company_a)
    @admin = admins(:company_a_admin)
    @root = DataSourceFolder.create!(
      name: "ルート",
      company: @company,
      created_by: @admin
    )
    @child = DataSourceFolder.create!(
      name: "子フォルダ",
      company: @company,
      created_by: @admin,
      parent: @root
    )
    @grandchild = DataSourceFolder.create!(
      name: "孫フォルダ",
      company: @company,
      created_by: @admin,
      parent: @child
    )
  end

  # === breadcrumb テスト ===

  test "breadcrumb: ルートフォルダは自身のみ" do
    assert_equal [@root], @root.breadcrumb
  end

  test "breadcrumb: 子フォルダはルートから自身まで" do
    assert_equal [@root, @child], @child.breadcrumb
  end

  test "breadcrumb: 孫フォルダはルートから自身まで" do
    assert_equal [@root, @child, @grandchild], @grandchild.breadcrumb
  end

  # === prevent_circular_reference テスト ===

  test "prevent_circular_reference: 自分自身を親にできない" do
    @root.parent_id = @root.id
    assert_not @root.valid?
    assert @root.errors[:parent_id].any?
  end

  test "prevent_circular_reference: 子を親にすると循環参照エラー" do
    @root.parent_id = @child.id
    assert_not @root.valid?
    assert @root.errors[:parent_id].any?
  end

  test "prevent_circular_reference: 孫を親にすると循環参照エラー" do
    @root.parent_id = @grandchild.id
    assert_not @root.valid?
    assert @root.errors[:parent_id].any?
  end

  test "prevent_circular_reference: 正常な親設定はエラーにならない" do
    new_folder = DataSourceFolder.create!(
      name: "別フォルダ",
      company: @company,
      created_by: @admin
    )
    @child.parent = new_folder
    assert @child.valid?
  end
end
