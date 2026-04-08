module SessionsHelper
  def login(user, user_type = 'user')
    session[:uid] = user.id
    session[:user_type] = user_type
    session[:session_token] = user.get_session_token
    session[:expires_at] = 60.minutes.from_now
  end

  def current_user
    Rails.logger.debug("session[:uid]: #{session[:uid]}")
    return nil unless session[:uid] && session[:user_type]
    
    if session[:user_type] == 'admin'
      @current_user ||= Admin.find_by(id: session[:uid], session_token: session[:session_token])
    else
      @current_user ||= User.find_by(id: session[:uid], session_token: session[:session_token])
    end
  end

  def current_admin?
    session[:user_type] == 'admin' && current_user.present?
  end

  def current_regular_user?
    session[:user_type] == 'user' && current_user.present?
  end

  def set_forwarding_url
    session[:forwarding_url] = request.fullpath
  end

  def current_user_company_admin?
    # Admin型で会社に紐づいている場合 = Company Admin
    return true if current_admin? && current_user&.company_id.present?
    # User型でrole=company_adminの場合
    !!current_user&.respond_to?(:role_company_admin?) && current_user.role_company_admin?
  end

  def admin_or_company_admin?
    current_admin? || current_user_company_admin?
  end

  # データソース関連の権限を持つUserかどうか（サイドバー表示制御用）
  def user_has_ds_permission?
    return false unless current_regular_user? && current_user.present?

    group_ids = current_user.user_group_ids

    Permission.where(
      company_id: current_company_id,
      permissible_type: ["DataSourceFolder", "DataSourceFile"],
      deleted_at: nil
    ).where(
      "(grantee_type = 'User' AND grantee_id = :user_id)" \
      "#{group_ids.present? ? " OR (grantee_type = 'UserGroup' AND grantee_id IN (:group_ids))" : ""}",
      user_id: current_user.id,
      group_ids: group_ids.presence || [""]
    ).exists?
  end

  # 社内辞書の編集権限を持つか（admin/company_admin、または会社内でeditor以上の権限を持つUser）
  def user_can_edit_glossary?
    return true if admin_or_company_admin?
    return false unless current_regular_user? && current_user.present?

    group_ids = current_user.user_group_ids

    Permission.where(
      company_id: current_company_id,
      deleted_at: nil
    ).where(role: [:editor, :owner]).where(
      "(grantee_type = 'User' AND grantee_id = :user_id)" \
      "#{group_ids.present? ? " OR (grantee_type = 'UserGroup' AND grantee_id IN (:group_ids))" : ""}",
      user_id: current_user.id,
      group_ids: group_ids.presence || [""]
    ).exists?
  end

  def logout
    session.delete(:uid)
    session.delete(:user_type)
    session.delete(:session_token)
    @current_user = nil
  end

  def logged_in?
    current_user.present?
  end

  def login_check
    # デモモード: 未ログインなら自動的にデモユーザーでログイン
    if ENV['DEMO_MODE'] == 'true' && !logged_in?
      demo_user = User.find_by(email: 'demo@example.com')
      if demo_user
        login(demo_user, 'user')
        @current_user = nil # メモ化をリセットして再取得させる
      end
    end

    unless logged_in?
      flash[:alert] = "ログインが必要です。"
      set_forwarding_url
      return redirect_to login_path
    end
    set_session_timeout
  end

  def admin_required
    unless admin_or_company_admin?
      flash[:alert] = "管理者権限が必要です。"
      redirect_to root_path
    end
  end

  def privileged_admin?
    current_admin? && current_user.company_id.nil?
  end

  def privileged_admin_required
    unless privileged_admin?
      flash[:alert] = "特権管理者権限が必要です。"
      redirect_to root_path
    end
  end

  def current_company_id
    current_user&.company_id
  end

  def set_session_timeout
    if session[:uid] && session[:expires_at] && session[:expires_at] < Time.current
      if ENV['DEMO_MODE'] == 'true'
        # デモモードではタイムアウトせずセッション延長のみ
        session[:expires_at] = 60.minutes.from_now
        return
      end
      logout
      flash[:alert] = "ログインセッションがタイムアウトしました"
      return redirect_to login_path
    end
    session[:expires_at] = 60.minutes.from_now
  end
end
