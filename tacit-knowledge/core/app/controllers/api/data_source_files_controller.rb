module Api
  class DataSourceFilesController < ApplicationController
    include RequireCompanyContext
    include DataSourceAccessControl

    ALLOWED_FILE_TYPES = %w[pdf xlsx xls docx doc pptx ppt csv txt].freeze
    SEARCH_LIMIT = 50

    skip_before_action :verify_authenticity_token
    before_action :require_company_context
    before_action :set_file, only: [:update, :move, :download, :destroy, :linked_topics, :retry_ai]
    before_action :require_ds_editor, only: [:create, :update, :move, :destroy, :retry_ai, :retry_ai_all]
    before_action :require_ds_viewer, only: [:download, :linked_topics]

    # POST /api/data_source_files
    def create
      uploaded_files = params[:files]
      unless uploaded_files.present?
        render json: { success: false, errors: ["ファイルが選択されていません"] }, status: :unprocessable_entity
        return
      end

      folder_id = params[:folder_id]

      if folder_id.present? && !folder_scope.exists?(id: folder_id)
        render json: { success: false, errors: ["指定されたフォルダが見つかりません"] }, status: :unprocessable_entity
        return
      end

      created_files = []

      ActiveRecord::Base.transaction do
        uploaded_files.each do |file|
          filename = file.original_filename.to_s.delete("\u0000")
          file_type = File.extname(filename).delete(".").downcase

          unless ALLOWED_FILE_TYPES.include?(file_type)
            raise ActiveRecord::Rollback
          end

          resolved_company_id = if current_company_id.present?
                                  current_company_id
                                elsif folder_id.present?
                                  folder_scope.find(folder_id).company_id
                                end

          s3_key = upload_to_s3(file, filename, company_id: resolved_company_id)

          ds_file = DataSourceFile.create!(
            company_id: resolved_company_id,
            folder_id: folder_id.presence,
            name: filename,
            key: s3_key,
            file_type: file_type,
            file_size: file.size,
            ai_status: :pending,
            created_by: current_user,
            updated_by: current_user
          )

          created_files << ds_file
        end
      end

      if created_files.empty? && uploaded_files.present?
        render json: { success: false, errors: ["許可されていないファイル形式です。対応形式: #{ALLOWED_FILE_TYPES.join(', ')}"] }, status: :unprocessable_entity
        return
      end

      # SQSエンキューはトランザクション成功後に実行
      created_files.each { |f| enqueue_ai_processing(f) }

      render json: {
        success: true,
        files: created_files.map { |f| file_json(f) }
      }, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
    end

    # PATCH /api/data_source_files/:id
    def update
      new_name = params[:name].to_s.delete("\u0000")

      if @file.update(name: new_name, updated_by: current_user)
        render json: { success: true, file: file_json(@file) }
      else
        render json: { success: false, errors: @file.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/data_source_files/:id/move
    def move
      target_folder_id = params[:folder_id]

      if target_folder_id.present? && !folder_scope.exists?(id: target_folder_id)
        render json: { success: false, errors: ["移動先フォルダが見つかりません"] }, status: :unprocessable_entity
        return
      end

      # 移動先フォルダへのeditor権限チェック（Admin/CompanyAdminはスキップ）
      unless current_admin? || current_user_company_admin?
        if target_folder_id.present?
          dest = folder_scope.find_by(id: target_folder_id)
          unless dest&.editable_by?(current_user, session[:user_type])
            render json: { success: false, errors: ["移動先フォルダへの編集権限がありません"] }, status: :forbidden
            return
          end
        end
      end

      if @file.update(folder_id: target_folder_id, updated_by: current_user)
        render json: { success: true, file: file_json(@file) }
      else
        render json: { success: false, errors: @file.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # GET /api/data_source_files/:id/download
    def download
      url = Storage::Api.presigned_url(@file.key, filename: @file.name)
      if url
        redirect_to url, allow_other_host: true
      else
        render json: { success: false, errors: ["ダウンロードURLの生成に失敗しました"] }, status: :internal_server_error
      end
    end

    # DELETE /api/data_source_files/:id
    def destroy
      affected_topics = @file.linked_topics.map { |t| { id: t.id, name: t.name } }
      @file.destroy
      render json: { success: true, affected_topics: affected_topics }
    end

    # GET /api/data_source_files/search?q=xxx
    def search
      query = params[:q].to_s.delete("\u0000").strip
      if query.blank?
        render json: { files: [], total: 0 }
        return
      end

      escaped = sanitize_sql_like(query)

      # ファイル名 OR ファイル内容（data_knowledge_documents.text）で検索
      content_matches = content_search_with_snippets(escaped)
      content_match_ids = content_matches.keys

      files = file_scope
                .where("name ILIKE :q OR data_source_files.id IN (:ids)",
                       q: "%#{escaped}%", ids: content_match_ids.presence || ["00000000-0000-0000-0000-000000000000"])
                .order(updated_at: :desc)
                .limit(SEARCH_LIMIT)

      # Userは閲覧権限のあるファイルのみ返す（Admin/CompanyAdminは全表示）
      unless current_admin? || current_user_company_admin?
        user_type = session[:user_type]
        files = files.select { |f| f.viewable_by?(current_user, user_type) }
      end

      render json: {
        files: files.map { |f| file_json(f, snippet: content_matches[f.id]) },
        total: files.size,
        query: query
      }
    end

    # POST /api/data_source_files/:id/retry_ai
    def retry_ai
      unless @file.ai_status_before_type_cast.in?([0, 3]) # pending or failed
        render json: { success: false, error: "AI学習が既に完了または処理中です" }, status: :unprocessable_entity
        return
      end

      @file.update!(ai_status: :pending)
      enqueue_ai_processing(@file)
      render json: { success: true, message: "AI学習を再キューしました", file_id: @file.id }
    end

    # POST /api/data_source_files/retry_ai_all
    def retry_ai_all
      files = file_scope.where(ai_status: [:pending, :failed])
      if files.empty?
        render json: { success: true, message: "再処理対象のファイルはありません", count: 0 }
        return
      end

      count = 0
      files.find_each do |f|
        f.update!(ai_status: :pending)
        enqueue_ai_processing(f)
        count += 1
      end
      render json: { success: true, message: "#{count}件のファイルをAI学習キューに追加しました", count: count }
    end

    # POST /api/data_source_files/bulk_create_topic
    def bulk_create_topic
      file_ids = params[:file_ids] || []
      files = file_scope.where(id: file_ids)

      if files.empty?
        render json: { success: false, errors: ["ファイルが選択されていません"] }, status: :unprocessable_entity
        return
      end

      # 各ファイルに対するeditor権限をチェック（Admin/CompanyAdminはスキップ）
      unless current_admin? || current_user_company_admin?
        user_type = session[:user_type]
        unauthorized = files.reject { |f| f.editable_by?(current_user, user_type) }
        if unauthorized.any?
          render json: { error: "権限がありません" }, status: :forbidden
          return
        end
      end

      topic = nil
      completed_files = []

      ActiveRecord::Base.transaction do
        resolved_company_id = current_company_id.presence || files.first.company_id
        topic = Topic.create!(
          name: params[:topic_name] || "データソースから作成: #{files.first.name}",
          description: "データソースファイルから作成されたトピック",
          created_by: current_user,
          company_id: resolved_company_id,
          status: :not_started
        )

        # 作成者にトピックの編集権限を付与（トピック一覧で表示されるようにする）
        unless current_admin? || current_user_company_admin?
          Permission.create!(
            company_id: topic.company_id,
            permissible: topic,
            grantee_type: current_user.class.name,
            grantee_id: current_user.id,
            role: :editor
          )
        end

        # 中間テーブルにリンク作成（AI学習状態に関わらず全ファイル）
        # ユーザーが明示的に選択したファイルは全てリンクする。
        # AI学習が未完了のファイルも、完了後にretrieve_contextで参照可能になる。
        files.each do |file|
          TopicDataSourceLink.create!(
            topic: topic,
            data_source_file: file,
            linked_by: current_user
          )
        end
      end

      # レガシー: metadata_.topic_id も更新（トランザクション外で実行 — 失敗してもトピック作成に影響しない）
      unless ENV["DISABLE_LEGACY_TOPIC_METADATA"] == "true"
        linked_count = link_datasource_vectors_to_topic(file_ids, topic.id)
        Rails.logger.info "Legacy: Linked #{linked_count} vector chunks to topic #{topic.id}"
      end

      render json: {
        success: true,
        topic_id: topic.id,
        topic_name: topic.name,
        linked_files: files.size
      }
    rescue ActiveRecord::RecordInvalid => e
      render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
    end

    # GET /api/data_source_files/:id/linked_topics
    def linked_topics
      links = @file.topic_data_source_links
                   .includes(:topic)
                   .order(created_at: :desc)

      topics = links.map do |link|
        topic = link.topic
        {
          id: topic.id,
          name: topic.name,
          description: topic.description,
          status: topic.status,
          link_id: link.id,
          linked_at: link.created_at,
          linked_by_id: link.linked_by_id,
          linked_by_type: link.linked_by_type
        }
      end

      render json: { topics: topics, total: topics.size }
    end

    private

    def link_datasource_vectors_to_topic(file_ids, topic_id)
      return 0 if file_ids.empty?

      sanitized_sql = ActiveRecord::Base.sanitize_sql_array([
        <<~SQL,
          UPDATE data_knowledge_documents
          SET metadata_ = (metadata_::jsonb || jsonb_build_object('topic_id', ?::text))::json
          WHERE (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IN (?)
        SQL
        topic_id,
        file_ids
      ])

      result = ActiveRecord::Base.connection.execute(sanitized_sql)
      result.cmd_tuples
    rescue => e
      Rails.logger.error "Failed to link datasource vectors to topic #{topic_id}: #{e.message}"
      0
    end

    def set_file
      @file = file_scope.find(params[:id])
    end

    def file_json(file, snippet: nil)
      json = {
        id: file.id,
        name: file.name,
        file_type: file.file_type,
        file_size: file.file_size,
        ai_status: file.ai_status,
        folder_id: file.folder_id,
        type: "file",
        created_at: file.created_at,
        updated_at: file.updated_at,
        updated_by_id: file.updated_by_id
      }
      json[:snippet] = snippet if snippet.present?
      json
    end

    def upload_to_s3(file, filename, company_id: nil)
      directory = "datasource/#{company_id || current_company_id}/#{Time.current.to_i}"

      begin
        result = Storage::Api.upload(file, directory, extra_extensions: ALLOWED_FILE_TYPES)
        result[:key]
      rescue Aws::Errors::MissingCredentialsError, Aws::Sigv4::Errors::MissingCredentialsError => e
        Rails.logger.warn "S3 upload skipped (no credentials): #{e.message}. Using local key."
        # ローカル開発時はS3アップロードをスキップしキーのみ返す
        local_dir = Rails.root.join("tmp", "uploads", directory)
        FileUtils.mkdir_p(local_dir)
        FileUtils.cp(file.tempfile.path, local_dir.join(filename))
        "#{directory}/#{filename}"
      end
    end

    def enqueue_ai_processing(ds_file)
      return unless ENV.fetch("SQS_DOCUMENT_PROCESSING_QUEUE_URL", nil).present?

      sqs = Aws::SQS::Client.new
      sqs.send_message(
        queue_url: ENV.fetch("SQS_DOCUMENT_PROCESSING_QUEUE_URL"),
        message_body: {
          action_type: "datasource_upload",
          company_id: ds_file.company_id,
          data_source_file_ids: [ds_file.id],
          folder_id: ds_file.folder_id,
          timestamp: Time.current.iso8601
        }.to_json
      )
    rescue => e
      Rails.logger.error "Failed to enqueue AI processing for DataSourceFile #{ds_file.id}: #{e.message}"
    end

    # ファイル内容を検索し、file_id => snippet のHashを返す
    # document_id は LlamaIndex の _node_content 内または metadata_ 直下の両方に対応
    def content_search_with_snippets(escaped_query)
      sql = <<~SQL
        SELECT DISTINCT ON (file_id)
          COALESCE(
            (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id',
            metadata_::jsonb->>'document_id'
          ) AS file_id,
          SUBSTRING(text FROM GREATEST(1, POSITION(LOWER(?) IN LOWER(text)) - 50) FOR 120) AS snippet
        FROM data_knowledge_documents
        WHERE text ILIKE ?
          AND (
            (metadata_::jsonb->>'_node_content')::jsonb->'metadata'->>'document_id' IS NOT NULL
            OR metadata_::jsonb->>'document_id' IS NOT NULL
          )
        ORDER BY file_id
        LIMIT ?
      SQL
      sanitized = ActiveRecord::Base.sanitize_sql_array([sql, escaped_query, "%#{escaped_query}%", SEARCH_LIMIT])
      rows = ActiveRecord::Base.connection.select_rows(sanitized)
      rows.to_h { |file_id, snippet| [file_id, snippet&.strip] }
    rescue => e
      Rails.logger.warn "Content search failed: #{e.message}"
      {}
    end

    def file_scope
      privileged_admin? ? DataSourceFile.all : DataSourceFile.for_company(current_company_id)
    end

    def folder_scope
      privileged_admin? ? DataSourceFolder.all : DataSourceFolder.for_company(current_company_id)
    end

    def sanitize_sql_like(string)
      string.gsub(/[%_\\]/) { |m| "\\#{m}" }
    end

  end
end
