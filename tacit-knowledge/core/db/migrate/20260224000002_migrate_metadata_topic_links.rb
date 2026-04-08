class MigrateMetadataTopicLinks < ActiveRecord::Migration[8.0]
  def up
    # data_knowledge_documents テーブルが存在しない場合はスキップ
    unless table_exists?(:data_knowledge_documents)
      say "data_knowledge_documents テーブルが存在しないためスキップ"
      return
    end

    sql = <<~SQL
      SELECT DISTINCT
        metadata_->>'topic_id' AS topic_id,
        (metadata_::jsonb->'_node_content')::jsonb->'metadata'->>'document_id' AS document_id
      FROM data_knowledge_documents
      WHERE metadata_->>'topic_id' IS NOT NULL
        AND (metadata_::jsonb->'_node_content')::jsonb->'metadata'->>'document_id' IS NOT NULL
    SQL

    conn = ActiveRecord::Base.connection
    rows = conn.execute(sql)

    rows.each do |row|
      topic_id = row["topic_id"]
      file_id = row["document_id"]

      # モデルを使わず生SQLで存在チェック
      topic_exists = conn.select_value(
        "SELECT 1 FROM topics WHERE id = #{conn.quote(topic_id)} LIMIT 1"
      )
      next unless topic_exists

      file_exists = conn.select_value(
        "SELECT 1 FROM data_source_files WHERE id = #{conn.quote(file_id)} LIMIT 1"
      )
      next unless file_exists

      # created_by の取得
      created_by_id = conn.select_value(
        "SELECT created_by_id FROM topics WHERE id = #{conn.quote(topic_id)}"
      )
      created_by_type = conn.select_value(
        "SELECT created_by_type FROM topics WHERE id = #{conn.quote(topic_id)}"
      )

      # 重複チェック付きINSERT
      ulid = ULID.generate
      insert_sql = <<~INSERT
        INSERT INTO topic_data_source_links (id, topic_id, data_source_file_id, linked_by_id, linked_by_type, created_at)
        SELECT #{conn.quote(ulid)}, #{conn.quote(topic_id)}, #{conn.quote(file_id)},
               #{conn.quote(created_by_id)}, #{conn.quote(created_by_type || 'User')}, NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM topic_data_source_links
          WHERE topic_id = #{conn.quote(topic_id)} AND data_source_file_id = #{conn.quote(file_id)}
        )
      INSERT

      conn.execute(insert_sql)
    end
  end

  def down
    execute "DELETE FROM topic_data_source_links"
  end
end
