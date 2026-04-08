module Dev
  class SessionsController < ApplicationController
    skip_before_action :login_check

    before_action :ensure_development!

    def switch
      user_type = params[:user_type]
      id = params[:id]

      if user_type == "admin"
        account = Admin.find_by(id: id)
      else
        account = User.find_by(id: id)
      end

      unless account
        flash[:alert] = "ユーザーが見つかりません"
        return redirect_back(fallback_location: root_path)
      end

      login(account, user_type)
      flash[:notice] = "#{account.name}（#{user_type == 'admin' ? '管理者' : account.role}）に切り替えました"
      redirect_to root_path
    end

    private

    def ensure_development!
      raise ActionController::RoutingError, "Not Found" unless Rails.env.development?
    end
  end
end
