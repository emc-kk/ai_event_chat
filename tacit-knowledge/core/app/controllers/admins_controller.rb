class AdminsController < ApplicationController
  before_action :admin_required
  before_action :set_admin, only: %i[ show edit update destroy confirm resend_confirmation ]

  # GET /admins
  def index
    @title = "管理者管理"
    @admins = admin_scope.page(params[:page])
  end

  # GET /admins/1
  def show
    @title = "管理者詳細"
  end

  # GET /admins/new
  def new
    @title = "新規管理者登録"
    @admin = Admin.new
    @admin.password_change_required = true
  end

  # GET /admins/1/edit
  def edit
    @title = "管理者編集"
    @admin.password_change_required = false
  end

  # POST /admins
  def create
    @admin = Admin.new(admin_params)
    @admin.password_change_required = true
    @admin.company_id = determine_company_id_for_create

    if @admin.save
      @admin.send_confirmation_instructions
      redirect_to admins_url, notice: "管理者が正常に作成されました。確認メールを送信しました。"
    else
      @title = "新規管理者登録"
      render :new, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /admins/1
  def update
    @admin.password_change_required = false
    email_changed = admin_params_for_update[:email].present? && admin_params_for_update[:email] != @admin.email

    if @admin.update(admin_params_for_update)
      if email_changed
        @admin.update!(confirmed_at: nil)
        @admin.send_confirmation_instructions
        redirect_to admins_url, notice: "管理者が正常に更新されました。メールアドレスが変更されたため確認メールを送信しました。"
      else
        redirect_to admins_url, notice: "管理者が正常に更新されました。"
      end
    else
      @title = "管理者編集"
      render :edit, status: :unprocessable_entity
    end
  end

  # PATCH /admins/1/confirm
  def confirm
    @admin.confirm!
    redirect_to admins_url, notice: "#{@admin.name} を確認済みに変更しました。"
  end

  # PATCH /admins/1/resend_confirmation
  def resend_confirmation
    if @admin.confirmed?
      redirect_to admins_url, alert: "この管理者は既に確認済みです。"
    else
      @admin.resend_confirmation_instructions
      redirect_to admins_url, notice: "#{@admin.name} に確認メールを再送信しました。"
    end
  end

  # DELETE /admins/1
  def destroy
    @admin.destroy!
    redirect_to admins_url, notice: "管理者が正常に削除されました。"
  end

  private

  def set_admin
    @admin = admin_scope.find(params[:id])
  end

  def admin_scope
    if privileged_admin?
      Admin.all
    else
      Admin.for_company(current_company_id)
    end
  end

  def determine_company_id_for_create
    if privileged_admin?
      company_id_param = params[:admin][:company_id]
      company_id_param.blank? ? nil : company_id_param
    else
      current_company_id
    end
  end

  def admin_params
    permitted = [:name, :email, :password, :password_confirmation]
    permitted << :company_id if privileged_admin?
    params.require(:admin).permit(permitted)
  end

  def admin_params_for_update
    permitted = [:name, :email]
    permitted << :company_id if privileged_admin?
    params.require(:admin).permit(permitted)
  end
end
