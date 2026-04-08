class CreateChapters < ActiveRecord::Migration[8.0]
  def change
    create_table :chapters, id: :string, limit: 26, comment: 'チャプター保存' do |t|
      t.references :manual, null: false, foreign_key: true, type: :string, limit: 26, comment: 'マニュアルID'
      t.integer :position, null: false, comment: '表示順'
      t.decimal :start_time, precision: 10, scale: 3, null: false, comment: '開始時間(秒)'
      t.decimal :end_time, precision: 10, scale: 3, null: false, comment: '終了時間(秒)'
      t.string :title, comment: 'タイトル'
      t.text :description, comment: '説明'
      t.text :thumbnail_path, comment: 'サムネイルパス'
      t.boolean :is_visible, null: false, default: true, comment: '表示可否'

      t.timestamps
    end
  end
end
