# トピック関連リソースへのアクセス制御を提供するConcern
#
# 使い方:
#   class SomeController < ApplicationController
#     include TopicAccessControl
#     before_action :require_topic_viewer   # viewer以上
#     before_action :require_topic_editor   # editor以上
#   end
#
# トピックの解決方法:
#   1. @topic が設定されていればそれを使用
#   2. params[:topic_id] からTopicを検索
#   3. @request が設定されていればそのtopicを使用
#   4. @room が設定されていればそのrequest/topicを使用
#
module TopicAccessControl
  extend ActiveSupport::Concern

  private

  # viewer以上の権限を要求（閲覧系）
  def require_topic_viewer
    return if admin_or_company_admin?

    topic = resolve_topic_for_permission
    return if topic&.viewable_by?(current_user, session[:user_type])

    deny_access
  end

  # editor以上の権限を要求（編集系）
  def require_topic_editor
    return if admin_or_company_admin?

    topic = resolve_topic_for_permission
    return if topic&.editable_by?(current_user, session[:user_type])

    deny_access
  end

  # 権限チェック用のトピックを解決
  def resolve_topic_for_permission
    # 1. @topic が設定済み
    return @topic if @topic.present?

    # 2. params[:topic_id] またはネストされたparams から取得
    topic_id = params[:topic_id] || params.dig(:request, :topic_id)
    if topic_id.present?
      return Topic.find_by(id: topic_id)
    end

    # 3. @request から取得
    if defined?(@request) && @request.present?
      return @request.topic
    end

    # 4. @room から取得
    if defined?(@room) && @room.present?
      return @room.topic || @room.request&.topic
    end

    nil
  end

  def deny_access
    respond_to do |format|
      format.html { redirect_to topics_path, alert: "この操作を行う権限がありません" }
      format.json { render json: { error: "権限がありません" }, status: :forbidden }
    end
  end
end
