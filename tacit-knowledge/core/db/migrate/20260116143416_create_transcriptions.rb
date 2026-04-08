class CreateTranscriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :transcriptions, id: :string, limit: 26, comment: '字幕保存' do |t|
      t.references :manual, null: false, foreign_key: true, type: :string, limit: 26, comment: 'マニュアルID'
      t.integer :sequence, null: false, comment: '字幕表示連番'
      t.decimal :start_second, precision: 10, scale: 3, null: false, comment: '開始時間(秒)'
      t.decimal :end_second, precision: 10, scale: 3, null: false, comment: '終了時間(秒)'
      t.text :text, null: false, comment: '字幕テキスト'
      t.string :speaker, comment: '発話者'

      t.timestamps
    end
  end
end
