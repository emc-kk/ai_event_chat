class AddVideoKeysToManuals < ActiveRecord::Migration[8.0]
  def change
    add_column :manuals, :input_video_key, :text
    add_column :manuals, :hls_video_key, :text
  end
end
