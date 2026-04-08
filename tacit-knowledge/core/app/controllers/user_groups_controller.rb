class UserGroupsController < ApplicationController
  before_action :admin_required
  before_action :set_user_group, only: [:edit, :update, :destroy, :members, :add_members, :remove_member]

  def index
    @user_groups = group_scope.includes(:user_group_memberships).order(:name)
    @title = "ユーザーグループ管理"
  end

  def new
    @user_group = UserGroup.new
    @title = "新規グループ作成"
  end

  def create
    @user_group = UserGroup.new(user_group_params)
    @user_group.company_id = resolve_company_id
    @user_group.created_by = current_user

    if @user_group.save
      redirect_to user_groups_path, notice: "グループを作成しました"
    else
      @title = "新規グループ作成"
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    @title = "グループ編集"
  end

  def update
    if @user_group.update(user_group_params)
      redirect_to user_groups_path, notice: "グループを更新しました"
    else
      @title = "グループ編集"
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @user_group.destroy
    redirect_to user_groups_path, notice: "グループを削除しました"
  end

  # GET /user_groups/:id/members
  def members
    @memberships = @user_group.user_group_memberships.includes(:user).order("users.name")
    target_company_id = @user_group.company_id
    existing_user_ids = @memberships.map(&:user_id)
    @available_users = User.for_company(target_company_id).where.not(id: existing_user_ids).order(:name)
    @title = "#{@user_group.name} - メンバー管理"
  end

  # POST /user_groups/:id/add_members
  def add_members
    user_ids = params[:user_ids] || []
    # サーバーサイドで同一会社のユーザーのみに制限
    valid_user_ids = User.for_company(@user_group.company_id).where(id: user_ids).pluck(:id)
    added_count = 0

    valid_user_ids.each do |user_id|
      membership = @user_group.user_group_memberships.build(user_id: user_id)
      added_count += 1 if membership.save
    end

    redirect_to members_user_group_path(@user_group),
                notice: "#{added_count}名のメンバーを追加しました"
  end

  # DELETE /user_groups/:id/remove_member
  def remove_member
    membership = @user_group.user_group_memberships.find_by(user_id: params[:user_id])
    membership&.destroy
    redirect_to members_user_group_path(@user_group),
                notice: "メンバーを削除しました"
  end

  private

  def set_user_group
    @user_group = group_scope.find(params[:id])
  end

  def group_scope
    privileged_admin? ? UserGroup.all : UserGroup.for_company(current_company_id)
  end

  def user_group_params
    params.require(:user_group).permit(:name, :description)
  end

  def resolve_company_id
    if privileged_admin? && params.dig(:user_group, :company_id).present?
      company_id = params[:user_group][:company_id]
      # 指定された会社がアクティブに存在するか検証
      Company.status_active.find(company_id).id
    else
      current_company_id
    end
  end
end
