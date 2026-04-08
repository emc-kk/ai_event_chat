# feature_management パック

## 責務
企業別の機能フラグ管理。BCや画面単位でのON/OFF切り替えを提供する。

## 依存先（package.yml参照）
- . (root): ApplicationRecord, Company

## 公開API（public/）
- FeatureManager.for(company).enabled?(:flag_name)
- FeatureManager.enable!(company, :flag_name)
- FeatureManager.disable!(company, :flag_name)
- FeatureManager.sync!

## DBテーブル
- features: フラグのツリー構造（name, feature_type, parent_id）
- company_features: 企業ごとのON/OFF状態（company_id, feature_id, enabled）
