require "test_helper"

class HearingExtractTest < ActiveSupport::TestCase
  # === layer_name テスト ===

  test "layer_name: 各レイヤーの表示名を返す" do
    extract = HearingExtract.new(knowledge_layer: 0)
    assert_equal "原則", extract.layer_name

    extract.knowledge_layer = 1
    assert_equal "判断基準", extract.layer_name

    extract.knowledge_layer = 2
    assert_equal "リスク構造", extract.layer_name

    extract.knowledge_layer = 3
    assert_equal "案件事実", extract.layer_name

    extract.knowledge_layer = 4
    assert_equal "判断プロセス", extract.layer_name
  end

  test "layer_name: 未定義レイヤーはデフォルト表示" do
    extract = HearingExtract.new(knowledge_layer: 99)
    assert_equal "Layer 99", extract.layer_name
  end

  # === risk_axis_name テスト ===

  test "risk_axis_name: 各リスク軸の表示名を返す" do
    extract = HearingExtract.new(risk_axis: "target_risk")
    assert_equal "対象そのもののリスク", extract.risk_axis_name

    extract.risk_axis = "structural_risk"
    assert_equal "構造・契約のリスク", extract.risk_axis_name

    extract.risk_axis = "information_risk"
    assert_equal "情報・前提リスク", extract.risk_axis_name
  end

  test "risk_axis_name: 未定義軸はそのまま返す" do
    extract = HearingExtract.new(risk_axis: "unknown_risk")
    assert_equal "unknown_risk", extract.risk_axis_name
  end

  test "risk_axis_name: nilの場合nilを返す" do
    extract = HearingExtract.new(risk_axis: nil)
    assert_nil extract.risk_axis_name
  end
end
