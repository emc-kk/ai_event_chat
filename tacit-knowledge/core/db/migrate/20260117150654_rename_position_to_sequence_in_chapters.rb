class RenamePositionToSequenceInChapters < ActiveRecord::Migration[8.0]
  def change
    rename_column :chapters, :position, :sequence
    rename_column :chapters, :start_time, :start_second
    rename_column :chapters, :end_time, :end_second
  end
end
