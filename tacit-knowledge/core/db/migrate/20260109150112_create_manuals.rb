class CreateManuals < ActiveRecord::Migration[8.0]
  def change
    create_table :manuals, id: :string, limit: 26 do |t|
      t.references :topic, null: false, foreign_key: true, type: :string, limit: 26, comment: 'トピックID'
      t.references :request, null: false, foreign_key: true, type: :string, limit: 26, comment: 'リクエストID'
      t.text :body, comment: 'AIが生成したマニュアル本文'
      t.text :input_text, comment: 'マニュアル作成画面で入力したテキスト'

      t.timestamps
    end
  end
end
