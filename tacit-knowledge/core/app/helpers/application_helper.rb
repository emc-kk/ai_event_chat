module ApplicationHelper
  def active_class(path_or_pattern, is_dashboard = false)
    request_path = request.fullpath

    if path_or_pattern.is_a?(Regexp)
      request_path.match?(path_or_pattern) ? "active" : ""
    else
      current_page?(path_or_pattern) || request_path.include?(path_or_pattern) || request_path == "/" && is_dashboard ? "active" : ""
    end
  end

  ALLOWED_HEARING_STATUSES = %i[not_started inhearing awaiting_verification rehearing completed].freeze

  def can_access_chat?(request_record, chat_type)
    status_sym = request_record.status.to_sym
    case chat_type.to_s
    when 'hearing'
      ALLOWED_HEARING_STATUSES.include?(status_sym)
    else
      false
    end
  end

  def latest_room_path(parent, chat_type)
    scope = parent.rooms.where(chat_type: chat_type).active
    # ヒアリングは未完了のルームのみ返す（再ヒアリング時に完了済みルームへ遷移するのを防止）
    scope = scope.unfinished if chat_type == 'hearing'
    room = scope.order(created_at: :desc).first
    room ? room_path(room) : nil
  end

  def include_stylesheets
    stylesheets = ['application']

    case request.path
    when /rooms\/\w{26}/
      stylesheets << 'main'
      stylesheets << 'chat'
    else
      stylesheets << 'main'
    end

    stylesheets.map do |stylesheet|
      stylesheet_link_tag(stylesheet, 'data-turbo-track': 'reload')
    end.join("\n").html_safe
  end
end
