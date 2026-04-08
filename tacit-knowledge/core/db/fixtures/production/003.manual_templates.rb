# プリセットテンプレート初期データ
# - category: nil のテンプレートは全社に表示される汎用プリセット
# - category: "iso9001" 等のテンプレートはカテゴリ付きプリセット
PRESET_TEMPLATES = [
  {
    name: "ISO9001 作業手順書",
    category: "iso9001",
    description: "ISO9001準拠の作業手順書フォーマットで出力します。品質マネジメントシステムの文書管理要件を満たす形式です。",
    sections: [
      { name: "文書番号", instruction: "文書管理番号を記載する。形式: QMS-PROC-XXX" },
      { name: "改訂履歴", instruction: "改訂日、改訂内容、承認者を表形式で記載する" },
      { name: "目的", instruction: "この手順書の目的と適用する業務プロセスを明確に記述する" },
      { name: "適用範囲", instruction: "この手順書が適用される部門、工程、製品の範囲を定義する" },
      { name: "用語定義", instruction: "手順書内で使用する専門用語の定義を記載する" },
      { name: "責任者", instruction: "各工程の責任者と権限を明記する" },
      { name: "手順詳細", instruction: "作業手順をステップバイステップで記述する。判断基準・境界条件を含む" },
      { name: "判定基準", instruction: "合否判定の基準値、許容範囲を明確に記載する" },
      { name: "異常時対応", instruction: "異常発生時の対応手順、エスカレーションルールを記載する" },
      { name: "記録方法", instruction: "記録すべき項目、記録様式、保管期間を定義する" },
    ],
    output_format: :markdown,
  },
  {
    name: "ISO9001 検査基準書",
    category: "iso9001",
    description: "製造業の検査工程向けフォーマット。検査項目、合否判定基準、測定方法を体系的に記載します。",
    sections: [
      { name: "文書番号", instruction: "検査基準書の文書管理番号" },
      { name: "改訂履歴", instruction: "改訂日、改訂内容、承認者" },
      { name: "検査対象", instruction: "検査対象の製品・部品・工程を特定する" },
      { name: "検査項目一覧", instruction: "検査項目を一覧表形式で記載する" },
      { name: "合否判定基準", instruction: "各検査項目の合格基準値と不合格基準を明記する" },
      { name: "測定方法", instruction: "使用する測定器具、測定手順、校正要件を記載する" },
      { name: "許容範囲", instruction: "測定値の許容公差、ばらつき許容範囲を定義する" },
      { name: "記録様式", instruction: "検査記録の様式、記録項目、保管方法を定義する" },
    ],
    output_format: :markdown,
  },
  {
    name: "新人研修マニュアル",
    description: "OJT・教育訓練向けフォーマット。前提知識のない新人が段階的に習得できる構成です。",
    sections: [
      { name: "概要", instruction: "この業務の全体像と重要性を、新人にもわかるよう平易に説明する" },
      { name: "前提知識", instruction: "この業務を行うために最低限必要な知識・スキルを列挙する" },
      { name: "ステップバイステップ手順", instruction: "具体的な作業手順を、初心者が迷わないレベルで詳細に記述する。画面キャプチャの挿入箇所も示す" },
      { name: "よくある間違い", instruction: "新人が陥りやすいミスとその防止策を具体的に記載する" },
      { name: "チェックポイント", instruction: "作業中に自己確認すべきポイントをチェックリスト形式で記載する" },
      { name: "習熟度確認", instruction: "業務を一人で遂行できるかを確認するための確認テスト・評価基準を記載する" },
    ],
    output_format: :markdown,
  },
  {
    name: "業務ナレッジ（汎用）",
    description: "業種を問わず使える汎用フォーマット。判断基準と条件分岐を中心に暗黙知を文書化します。",
    sections: [
      { name: "背景", instruction: "この業務ナレッジが必要とされる背景・経緯を記述する" },
      { name: "判断基準", instruction: "ベテランが用いる判断基準を、条件と判断結果のペアで明確に記述する" },
      { name: "条件分岐", instruction: "状況に応じて手順が異なる場合の分岐条件と、それぞれの対応手順を記載する" },
      { name: "注意事項", instruction: "見落としやすいポイント、例外的なケース、リスクを記載する" },
      { name: "関連情報", instruction: "参考資料、関連する業務プロセス、問い合わせ先を記載する" },
    ],
    output_format: :markdown,
  },
]

PRESET_TEMPLATES.each do |template_data|
  template = ManualTemplate.find_or_initialize_by(name: template_data[:name], is_preset: true)
  template.assign_attributes(template_data)
  if template.new_record?
    template.save!
    puts "Created preset template: #{template_data[:name]}"
  elsif template.changed?
    template.save!
    puts "Updated preset template: #{template_data[:name]}"
  else
    puts "Preset template unchanged: #{template_data[:name]}"
  end
end
