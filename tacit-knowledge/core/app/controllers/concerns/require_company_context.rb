module RequireCompanyContext
  extend ActiveSupport::Concern

  private

  def require_company_context
    return if privileged_admin? || current_company_id.present?

    respond_to do |format|
      format.json { render json: { success: false, errors: ["会社コンテキストが必要です。会社に紐づく管理者でログインしてください。"] }, status: :forbidden }
      format.html { redirect_to root_path, alert: "会社に紐づく管理者でログインしてください。" }
    end
  end
end
