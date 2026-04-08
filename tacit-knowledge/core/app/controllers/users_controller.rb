class UsersController < ApplicationController
  before_action :admin_required
  before_action :set_user, only: [:show, :edit, :update, :destroy]

  # GET /users
  def index
    @title = "ユーザー管理"
    @users = user_scope.order(:id).page(params[:page])
  end

  # GET /users/1
  def show
    @title = "ユーザー詳細"
  end

  # GET /users/new
  def new
    @title = "新規ユーザー登録"
    @user = User.new
    @user.password_change_required = true
  end

  # GET /users/1/edit
  def edit
    @title = "ユーザー情報編集"
    @user.password_change_required = false
  end

  # POST /users
  def create
    @user = User.new(user_params)
    @user.password_change_required = true
    @user.company_id = current_company_id unless privileged_admin?

    # 同一メールアドレスの削除済みユーザーが存在する場合は完全削除して再登録可能にする
    deleted_user = User.only_deleted.find_by(email: @user.email)
    deleted_user&.really_destroy!

    if @user.save
      @user.send_confirmation_instructions
      redirect_to users_url, notice: 'ユーザーが正常に作成されました。確認メールを送信しました。'
    else
      @title = "新規ユーザー登録"
      render :new, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /users/1
  def update
    update_params = user_params_for_update
    email_changed = update_params[:email].present? && update_params[:email] != @user.email
    password_provided = update_params[:password].present?

    @user.password_change_required = password_provided

    # パスワードが空の場合はパラメータから除外
    unless password_provided
      update_params = update_params.except(:password, :password_confirmation)
    end

    if @user.update(update_params)
      if email_changed
        @user.update!(confirmed_at: nil)
        @user.send_confirmation_instructions
        redirect_to users_url, notice: 'ユーザーが正常に更新されました。メールアドレスが変更されたため確認メールを送信しました。'
      else
        redirect_to users_url, notice: 'ユーザーが正常に更新されました。'
      end
    else
      @title = "ユーザー編集"
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /users/1
  def destroy
    @user.destroy
    redirect_to users_url, notice: 'ユーザーが正常に削除されました。'
  end

  private

  def set_user
    @user = user_scope.find(params[:id])
  end

  def user_scope
    if privileged_admin?
      User.all
    else
      User.for_company(current_company_id)
    end
  end

  def user_params
    permitted = [:name, :department, :number, :description, :email, :password, :password_confirmation, :role]
    permitted << :company_id if privileged_admin?
    params.require(:user).permit(permitted).merge(creator: current_user)
  end

  def user_params_for_update
    permitted = [:name, :department, :number, :description, :email, :password, :password_confirmation, :role]
    permitted << :company_id if privileged_admin?
    params.require(:user).permit(permitted)
  end
end
