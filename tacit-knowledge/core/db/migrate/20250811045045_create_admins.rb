class CreateAdmins < ActiveRecord::Migration[8.0]
  def change
    create_table :admins, id: :string, limit: 26 do |t|
      t.string :name, comment: "管理者名"
      t.string :email, comment: "メールアドレス"
      t.string :password_digest, comment: "パスワード"
      t.integer :status, default: 0, comment: "ステータス"
      t.string :session_token, comment:  "セッショントークン"
      t.text :note, comment: "メモ"

      t.timestamps
    end
    add_index :admins, :email, unique: true
  end
end
