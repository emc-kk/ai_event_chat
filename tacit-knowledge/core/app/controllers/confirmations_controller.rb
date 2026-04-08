class ConfirmationsController < ApplicationController
  layout "guest"
  skip_before_action :login_check, only: [:show, :new, :create]

  # GET /confirmation?token=xxx&type=admin|user
  def show
    @token = params[:token]
    @type = params[:type]

    record = find_record_by_token(@token, @type)

    if record.nil?
      flash[:alert] = "無効な確認トークンです。"
      redirect_to login_path
    elsif record.confirmed?
      flash[:notice] = "メールアドレスは既に確認済みです。"
      redirect_to login_path
    elsif !record.confirmation_token_valid?
      flash[:alert] = "確認リンクの有効期限が切れています。再送信してください。"
      redirect_to new_confirmation_path
    else
      record.confirm!
      flash[:notice] = "メールアドレスが確認されました。ログインしてください。"
      redirect_to login_path
    end
  end

  # GET /confirmation/new - resend form
  def new
    @title = "確認メール再送信"
  end

  # POST /confirmation - resend confirmation
  def create
    email = params[:email]
    type = params[:type] || "admin"

    record = find_record_by_email(email, type)

    if record.nil?
      flash[:alert] = "メールアドレスが見つかりません。"
      render :new, status: :unprocessable_entity
    elsif record.confirmed?
      flash[:notice] = "メールアドレスは既に確認済みです。"
      redirect_to login_path
    else
      record.resend_confirmation_instructions
      flash[:notice] = "確認メールを再送信しました。メールをご確認ください。"
      redirect_to login_path
    end
  end

  private

  def find_record_by_token(token, type)
    return nil if token.blank? || type.blank?

    case type
    when "admin"
      Admin.find_by(confirmation_token: token)
    when "user"
      User.find_by(confirmation_token: token)
    end
  end

  def find_record_by_email(email, type)
    return nil if email.blank?

    case type
    when "admin"
      Admin.find_by(email: email)
    when "user"
      User.find_by(email: email)
    end
  end
end
