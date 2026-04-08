class ChangeRequestIdNullableOnMessages < ActiveRecord::Migration[8.0]
  def change
    change_column_null :messages, :request_id, true
  end
end
