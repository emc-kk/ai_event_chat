class RemoveGenerationPromptFromManualTemplates < ActiveRecord::Migration[8.0]
  def change
    if column_exists?(:manual_templates, :generation_prompt)
      remove_column :manual_templates, :generation_prompt, :text
    end
  end
end
