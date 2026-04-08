class DataSourcesController < ApplicationController
  def index
    @title = "データソース管理"

    unless privileged_admin? || current_company_id.present?
      flash[:alert] = "データソース管理を利用するには、会社に紐づくユーザーでログインしてください。"
      redirect_to root_path
      return
    end

  end

end
