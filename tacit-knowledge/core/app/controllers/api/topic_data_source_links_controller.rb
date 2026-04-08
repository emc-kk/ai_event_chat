module Api
  class TopicDataSourceLinksController < ApplicationController
    include RequireCompanyContext
    include TopicAccessControl

    skip_before_action :verify_authenticity_token
    before_action :require_company_context
    before_action :set_topic
    before_action :require_topic_viewer, only: [:index]
    before_action :require_topic_editor, only: [:create, :destroy]

    # GET /api/topics/:topic_id/data_source_links
    def index
      links = @topic.topic_data_source_links
                     .includes(:data_source_file)
                     .order(created_at: :desc)

      render json: {
        links: links.map { |link| link_json(link) },
        total: links.size
      }
    end

    # POST /api/topics/:topic_id/data_source_links
    def create
      file_ids = params[:data_source_file_ids] || []
      files = DataSourceFile.for_company(resolve_company_id)
                            .where(id: file_ids, ai_status: :completed)

      if files.empty?
        render json: { success: false, errors: ["リンク可能なファイルが見つかりません"] }, status: :unprocessable_entity
        return
      end

      # DSファイルへのeditor権限チェック（Admin/CompanyAdminはスキップ）
      unless current_admin? || current_user_company_admin?
        user_type = session[:user_type]
        unauthorized = files.reject { |f| f.editable_by?(current_user, user_type) }
        if unauthorized.any?
          render json: { error: "一部のファイルに対する編集権限がありません" }, status: :forbidden
          return
        end
      end

      created_links = []
      skipped_ids = []

      ActiveRecord::Base.transaction do
        files.each do |file|
          link = TopicDataSourceLink.new(
            topic: @topic,
            data_source_file: file,
            linked_by: current_user
          )
          if link.save
            created_links << link
          else
            skipped_ids << file.id
          end
        end
      end

      render json: {
        success: true,
        linked: created_links.map { |l| link_json(l) },
        skipped_ids: skipped_ids,
        total_linked: created_links.size
      }, status: :created
    end

    # DELETE /api/topics/:topic_id/data_source_links
    def destroy
      file_ids = params[:data_source_file_ids] || []
      links = @topic.topic_data_source_links.where(data_source_file_id: file_ids)

      if links.empty?
        render json: { success: false, errors: ["削除対象のリンクが見つかりません"] }, status: :not_found
        return
      end

      deleted_count = links.delete_all

      render json: { success: true, deleted_count: deleted_count }
    end

    private

    def set_topic
      scope = privileged_admin? ? Topic.all : Topic.for_company(current_company_id)
      @topic = scope.find(params[:topic_id])
    end

    def resolve_company_id
      privileged_admin? ? @topic.company_id : current_company_id
    end

    def link_json(link)
      file = link.data_source_file
      {
        id: link.id,
        topic_id: link.topic_id,
        data_source_file_id: link.data_source_file_id,
        file_name: file&.name,
        file_type: file&.file_type,
        file_size: file&.file_size,
        ai_status: file&.ai_status,
        linked_by_id: link.linked_by_id,
        linked_by_type: link.linked_by_type,
        created_at: link.created_at
      }
    end
  end
end
