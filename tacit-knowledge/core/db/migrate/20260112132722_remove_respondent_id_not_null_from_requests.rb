class RemoveRespondentIdNotNullFromRequests < ActiveRecord::Migration[8.0]
  def change
    change_column_null :requests, :respondent_id, true
  end
end
