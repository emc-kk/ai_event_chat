class Topics::ComparisonSessionsController < Topics::ApplicationController
  include TopicAccessControl

  before_action :set_topic
  before_action :require_topic_editor, except: %i[index show]
  before_action :require_topic_viewer, only: %i[index show]
  before_action :set_session, only: %i[show resolve complete destroy]

  def index
    @comparison_sessions = @topic.comparison_sessions.order(created_at: :desc)
    @title = "知識差分比較"
  end

  def new
    @hearing_requests = @topic.requests.hearing_type.status_history.includes(:respondent).order(created_at: :desc)
    @title = "知識差分比較 - 対象選択"
  end

  def create
    request_ids = params[:request_ids]&.reject(&:blank?)

    if request_ids.blank? || request_ids.size < 2
      @hearing_requests = @topic.requests.hearing_type.status_history.includes(:respondent).order(created_at: :desc)
      flash.now[:alert] = "比較には最低2つのヒアリング結果を選択してください。"
      @title = "知識差分比較 - 対象選択"
      render :new, status: :unprocessable_entity
      return
    end

    @comparison_session = @topic.comparison_sessions.new(
      request_ids: request_ids,
      created_by: current_user,
      status: :analyzing
    )

    if @comparison_session.save
      # AI Server に分析リクエストを送信
      trigger_comparison_analysis(@comparison_session)
      redirect_to topic_comparison_session_path(@topic, @comparison_session), notice: "比較分析を開始しました。"
    else
      @hearing_requests = @topic.requests.hearing_type.status_history.includes(:respondent).order(created_at: :desc)
      @title = "知識差分比較 - 対象選択"
      render :new, status: :unprocessable_entity
    end
  end

  def show
    @elements_consensus = @comparison_session.comparison_elements.consensus.order(:created_at)
    @elements_divergence = @comparison_session.comparison_elements.divergence.order(:created_at)
    @elements_gap = @comparison_session.comparison_elements.gap.order(:created_at)
    @title = "知識差分比較結果"
  end

  def resolve
    element = @comparison_session.comparison_elements.find(params[:element_id])

    attrs = {}
    attrs[:resolution] = params[:resolution] if params[:resolution].present?
    attrs[:resolution_detail] = params[:resolution_detail] if params[:resolution_detail].present?
    attrs[:resolution_comment] = params[:resolution_comment] if params[:resolution_comment].present?
    attrs[:resolution_note] = params[:resolution_note] if params.key?(:resolution_note)

    element.update!(attrs)

    render json: { success: true, element_id: element.id, resolution: element.resolution, resolution_note: element.resolution_note }
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  def complete
    if @comparison_session.all_resolved?
      @comparison_session.update!(status: :completed)
      redirect_to topic_comparison_session_path(@topic, @comparison_session), notice: "比較分析レポートを完了しました。"
    else
      redirect_to topic_comparison_session_path(@topic, @comparison_session), alert: "全ての項目が解決済みまたは対応方針が記入されている必要があります。"
    end
  end

  def destroy
    @comparison_session.destroy!
    redirect_to topic_comparison_sessions_path(@topic), notice: "比較結果を削除しました。"
  end

  private

  def set_topic
    @topic = Topic.find(params[:topic_id])
  end

  def set_session
    @comparison_session = @topic.comparison_sessions.find(params[:id])
  end

  def trigger_comparison_analysis(session)
    # バックグラウンドでAI Serverに送信（LLM処理に時間がかかるため非同期で実行）
    session_id = session.id
    topic_id = session.topic_id
    request_ids = session.request_ids.dup

    Thread.new do
      AiServerClient.connection.post("/api/comparison/analyze") do |req|
        req.body = {
          comparison_session_id: session_id,
          topic_id: topic_id,
          request_ids: request_ids
        }
      end
    rescue => e
      Rails.logger.error "Failed to trigger comparison analysis: #{e.message}"
    end
  end
end
