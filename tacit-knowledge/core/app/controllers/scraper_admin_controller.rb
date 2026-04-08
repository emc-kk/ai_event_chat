class ScraperAdminController < ApplicationController
  before_action :privileged_admin_required

  def index
    @title = "スクレイパー管理"
    @companies = Company.status_active.order(:name)
    @ai_server_url = ENV.fetch("AI_SERVER_URL", "")
  end
end
