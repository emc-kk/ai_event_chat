class GlossaryTermsController < ApplicationController
  before_action :require_company_context

  def index
  end

  private

  def require_company_context
    unless current_company_id.present?
      flash[:alert] = "社内辞書は会社に所属するユーザーのみ利用できます。"
      redirect_to root_path
    end
  end
end
