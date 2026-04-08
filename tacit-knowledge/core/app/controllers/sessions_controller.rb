class SessionsController < ApplicationController
  layout "guest"
  skip_before_action :login_check, only: %i[create new]

  def create
    # Admin を先にチェック（同一メールが User/Admin 両方に存在する場合に Admin 優先）
    admin = Admin.find_by(email: session_params[:account])

    if admin && admin.authenticate(session_params[:password])
      unless admin.confirmed?
        flash.now.alert = "メールアドレスが確認されていません。確認メールをご確認ください。"
        @unconfirmed_email = admin.email
        @user_type = "admin"
        render "new"
        return
      end

      login(admin, 'admin')
      redirect_to session.delete(:forwarding_url) || root_path, notice: "管理者としてログインしました！"
      return
    end

    user = User.find_by_email_or_username(session_params[:account]).first

    if user && user.authenticate(session_params[:password])
      unless user.confirmed?
        flash.now.alert = "メールアドレスが確認されていません。確認メールをご確認ください。"
        @unconfirmed_email = user.email
        @user_type = "user"
        render "new"
        return
      end

      login(user, 'user')
      redirect_to session.delete(:forwarding_url) || root_url, notice: "ログインしました！"
      return
    end

    flash.now.alert = "メールアドレスまたはパスワードが無効です"
    render "new"
  end

  def new
    redirect_to root_path if logged_in?
  end

  def destroy
    logout
    redirect_to login_url, notice: "ログアウトしました！"
  end

  private

  def session_params
    params.require(:session).permit(:account, :password)
  end
end
