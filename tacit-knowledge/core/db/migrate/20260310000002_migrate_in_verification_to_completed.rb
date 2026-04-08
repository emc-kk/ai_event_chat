class MigrateInVerificationToCompleted < ActiveRecord::Migration[8.0]
  def up
    # in_verification (3) -> completed (5)
    # 検証用チャットbot廃止に伴い、検証中ステータスのレコードを完了に移行
    execute "UPDATE requests SET status = 5, updated_at = NOW() WHERE status = 3"
  end

  def down
    # 不可逆マイグレーション（元の状態を復元する手段がない）
  end
end
