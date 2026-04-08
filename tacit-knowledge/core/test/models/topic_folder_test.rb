require "test_helper"

class TopicFolderTest < ActiveSupport::TestCase
  setup do
    @company = companies(:company_a)
    @admin = admins(:company_a_admin)
    @root = TopicFolder.create!(
      name: "ルートフォルダ",
      company: @company,
      created_by: @admin
    )
    @child = TopicFolder.create!(
      name: "子フォルダ",
      company: @company,
      created_by: @admin,
      parent: @root
    )
    @grandchild = TopicFolder.create!(
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

  # === breadcrumb_path テスト ===

  test "breadcrumb_path: ルートフォルダは名前のみ" do
    assert_equal "ルートフォルダ", @root.breadcrumb_path
  end

  test "breadcrumb_path: 子フォルダはスラッシュ区切り" do
    assert_equal "ルートフォルダ / 子フォルダ", @child.breadcrumb_path
  end

  test "breadcrumb_path: 孫フォルダまでスラッシュ区切り" do
    assert_equal "ルートフォルダ / 子フォルダ / 孫フォルダ", @grandchild.breadcrumb_path
  end
end
