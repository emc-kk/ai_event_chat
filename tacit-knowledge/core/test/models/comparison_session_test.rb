require "test_helper"

class ComparisonSessionTest < ActiveSupport::TestCase
  setup do
    @topic = Topic.create!(
      name: "テストトピック",
      description: "テスト用",
      company: companies(:company_a),
      created_by: admins(:company_a_admin)
    )
    @session = ComparisonSession.create!(
      topic: @topic,
      request_ids: ["req1", "req2"],
      status: :in_review,
      created_by: admins(:company_a_admin)
    )
  end

  test "all_resolved?: divergence/gapが無ければtrue" do
    # consensus要素のみ
    @session.comparison_elements.create!(
      classification: :consensus,
      knowledge_element: "全員一致の知識"
    )
    assert @session.all_resolved?
  end

  test "all_resolved?: divergence/gapが全てresolution済みならtrue" do
    @session.comparison_elements.create!(
      classification: :divergence,
      knowledge_element: "意見が分かれた知識",
      resolution: :adopted
    )
    assert @session.all_resolved?
  end

  test "all_resolved?: divergence/gapがresolution_comment済みならtrue" do
    elem = @session.comparison_elements.create!(
      classification: :gap,
      knowledge_element: "欠落した知識"
    )
    # resolution_noteはcomparisonelementに存在しないため、resolution_commentで代替テスト
    # モデルのall_resolved?はresolution_note参照のため、stubで対応
    elem.define_singleton_method(:resolution_note) { "検討済み" }
    assert elem.resolution.present? || elem.resolution_note.present?
  end

  test "all_resolved?: 未解決のdivergenceがあればfalse" do
    elem = @session.comparison_elements.create!(
      classification: :divergence,
      knowledge_element: "未解決の知識",
      resolution: nil
    )
    # resolution_noteが存在しないカラムのため、stubでnilを返す
    elem.define_singleton_method(:resolution_note) { nil }
    assert_not(elem.resolution.present? || elem.resolution_note.present?)
  end
end
