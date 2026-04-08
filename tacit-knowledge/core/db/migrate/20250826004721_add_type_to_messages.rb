class AddTypeToMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :messages, :type, :integer, default: 0, comment: "チャットタイプ（hearing/validation）"
    add_index :messages, :type
  end
end
