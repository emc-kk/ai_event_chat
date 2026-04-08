class AddResolutionNoteToComparisonElements < ActiveRecord::Migration[8.0]
  def change
    unless column_exists?(:comparison_elements, :resolution_note)
      add_column :comparison_elements, :resolution_note, :text
    end
  end
end
