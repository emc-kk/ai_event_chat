class CompaniesController < ApplicationController
  before_action :privileged_admin_required
  before_action :set_company, only: %i[ show edit update destroy ]

  # GET /companies
  def index
    @title = "会社管理"
    @companies = Company.page(params[:page])
  end

  # GET /companies/1
  def show
    @title = "会社詳細"
  end

  # GET /companies/new
  def new
    @title = "新規会社登録"
    @company = Company.new
  end

  # GET /companies/1/edit
  def edit
    @title = "会社編集"
  end

  # POST /companies
  def create
    @company = Company.new(company_params)

    if @company.save
      redirect_to companies_url, notice: "会社が正常に作成されました。"
    else
      @title = "新規会社登録"
      render :new, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /companies/1
  def update
    if @company.update(company_params)
      redirect_to companies_url, notice: "会社が正常に更新されました。"
    else
      @title = "会社編集"
      render :edit, status: :unprocessable_entity
    end
  end

  # DELETE /companies/1
  def destroy
    if @company.admins.any? || @company.users.any? || @company.topics.any?
      redirect_to companies_url, alert: "関連するデータが存在するため削除できません。"
    else
      @company.destroy!
      redirect_to companies_url, notice: "会社が正常に削除されました。"
    end
  end

  private

  def set_company
    @company = Company.find(params[:id])
  end

  def company_params
    params.require(:company).permit(:name, :description, :status)
  end
end
