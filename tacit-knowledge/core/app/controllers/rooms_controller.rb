class RoomsController < ApplicationController
  include TopicAccessControl

  before_action :set_parent, only: [:list, :create, :find_or_create]
  before_action :require_parent, only: [:create, :find_or_create]
  before_action :set_room, only: [:show]
  skip_before_action :verify_authenticity_token, only: [:create, :list, :find_or_create]
  before_action :admin_required, except: [:create, :list, :show, :find_or_create]
  before_action :require_room_viewer, only: [:show]
  before_action :require_parent_viewer, only: [:list, :create, :find_or_create]

  def show
    respond_to do |format|
      format.html do
        @request = @room.request
        @topic = @room.topic

        update_status_on_access

        case @room.chat_type
        when 'hearing'
          @title = [@topic&.name, @request&.name].compact.join(' - ').presence || 'ヒアリング'
          @subtitle = @request&.description
          @back_path = @request ? request_path(@request) : topics_path
          @has_conflicts = @request&.status_awaiting_verification? && CrossUserConflict.involving_request(@request.id).pending.exists?
        when 'topic'
          @title = @topic&.name || 'トピックチャット'
          @subtitle = @topic&.description
          @back_path = topics_path
          @completed_requests = @topic&.requests&.hearing_type&.where(status: :completed)&.includes(:respondent) || []
        else
          @title = 'チャット'
          @subtitle = nil
          @back_path = topics_path
        end
      end

      format.json do
        render json: {
          success: true,
          room: {
            id: @room.id,
            chat_type: @room.chat_type,
            request_id: @room.request_id,
            topic_id: @room.topic_id,
            request_content_id: @room.request_content_id,
            is_finished: @room.is_finished,
            is_deleted: @room.is_deleted,
            created_at: @room.created_at.iso8601
          }
        }
      end
    end
  end

  def list
    chat_type = params[:chat_type]

    Rails.logger.info "[RoomsController#list] params: #{params.to_unsafe_h}"
    Rails.logger.info "[RoomsController#list] @parent: #{@parent.inspect}"
    Rails.logger.info "[RoomsController#list] chat_type: #{chat_type}"

    rooms_scope = if @parent
      @parent.rooms.where(chat_type: chat_type).active.order(created_at: :desc)
    else
      Room.where(chat_type: chat_type).active.order(created_at: :desc)
    end

    Rails.logger.info "[RoomsController#list] rooms_scope SQL: #{rooms_scope.to_sql}"
    Rails.logger.info "[RoomsController#list] rooms_scope count: #{rooms_scope.count}"

    rooms_data = rooms_scope.map do |room|
      {
        id: room.id,
        name: room_display_name(room, chat_type),
        createdAt: room.created_at.iso8601,
        isFinished: room.is_finished,
        isDeleted: room.is_deleted
      }
    end

    Rails.logger.info "[RoomsController#list] rooms_data: #{rooms_data}"

    render json: { rooms: rooms_data }
  end

  def create
    chat_type = params[:chat_type] || 'hearing'
    request_content_id = params[:request_content_id]

    topic_id = resolve_topic_id

    new_room = @parent.rooms.create!(
      chat_type: chat_type,
      request_content_id: request_content_id,
      topic_id: topic_id,
      is_finished: false,
      is_deleted: false
    )

    render json: {
      success: true,
      room: {
        id: new_room.id,
        created_at: new_room.created_at.iso8601
      }
    }
  rescue => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  def find_or_create
    chat_type = params[:chat_type]
    request_content_id = params[:request_content_id]

    unless chat_type.present?
      render json: { success: false, error: 'chat_type is required' }, status: :bad_request
      return
    end

    existing_room = Room.find_existing_for_chat(@parent, chat_type, request_content_id)

    if existing_room
      render json: {
        success: true,
        room: {
          id: existing_room.id,
          created_at: existing_room.created_at.iso8601,
          is_new: false
        }
      }
    else
      new_room = Room.find_or_create_for_chat(@parent, chat_type, request_content_id)

      render json: {
        success: true,
        room: {
          id: new_room.id,
          created_at: new_room.created_at.iso8601,
          is_new: true
        }
      }
    end
  rescue => e
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end

  private

  def set_parent
    if params[:request_id].present?
      @parent = Request.find(params[:request_id])
    elsif params[:topic_id].present?
      @parent = Topic.find(params[:topic_id])
    end
  end

  def require_parent
    return if @parent
    render json: { error: 'request_id or topic_id is required' }, status: :bad_request
  end

  def set_room
    @room = Room.find(params[:id])
  end

  def update_status_on_access
    return unless @request

    case @room.chat_type
    when 'hearing'
      if @request.status_not_started?
        @request.update(status: :inhearing)
      end
    end
  end

  def resolve_topic_id
    if @parent.is_a?(Topic)
      @parent.id
    else
      @parent.topic_id
    end
  end

  def room_display_name(room, chat_type)
    case chat_type
    when 'hearing'
      @parent.respond_to?(:name) ? (@parent.name || "ヒアリング #{room.created_at.strftime('%m/%d %H:%M')}") : "ヒアリング #{room.created_at.strftime('%m/%d %H:%M')}"
    when 'topic'
      "トピックチャット #{room.created_at.strftime('%m/%d %H:%M')}"
    else
      "チャット #{room.created_at.strftime('%m/%d %H:%M')}"
    end
  end

  # list/create/find_or_create用: parent（Request or Topic）経由でトピック権限をチェック
  def require_parent_viewer
    return if current_admin?
    return unless @parent

    topic = @parent.is_a?(Topic) ? @parent : @parent.topic
    return if topic&.viewable_by?(current_user, session[:user_type])

    # requestに紐づくrespondentは自分のroomにアクセス可能
    return if @parent.is_a?(Request) && @parent.respondent_id == current_user&.id

    deny_access
  end

  # room#show用のviewer権限チェック（room経由でtopicを解決）
  def require_room_viewer
    return if current_admin?

    topic = @room&.topic || @room&.request&.topic
    return if topic&.viewable_by?(current_user, session[:user_type])

    # requestに紐づくrespondentは自分のroomにアクセス可能
    return if @room&.request&.respondent_id == current_user&.id

    deny_access
  end
end
