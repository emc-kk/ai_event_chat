Rails.application.config.after_initialize do
  if ActiveRecord::Base.connection.table_exists?(:features)
    FeatureManager.sync!
  end
rescue ActiveRecord::NoDatabaseError, ActiveRecord::ConnectionNotEstablished
  # DB未作成時やCI環境でのassets:precompile時はスキップ
end
