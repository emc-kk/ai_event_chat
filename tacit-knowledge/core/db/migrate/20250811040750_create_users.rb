class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users, id: :string, limit: 26 do |t|
      t.string :name, comment: "熱練者名"
      t.string :email, comment: "メールアドレス"
      t.string :department, comment: "所属部署"
      t.string :number, comment: "勤続年数"
      t.text :description, comment: "社内経歴"
      t.string :password_digest, comment: "パスワード"
      t.integer :created_by, null: false, comment: "作成者"
      t.datetime :deleted_at, comment: "削除日時"
      t.integer :status, default: 0, comment: "ステータス"
      t.string :session_token, comment:  "セッショントークン"
      t.text :note, comment: "メモ"

      t.timestamps
    end
    add_index :users, :email, unique: true
  end
end
