class ManualTemplatesController < ApplicationController
  before_action :set_template, only: %i[show edit update destroy duplicate]

  def index
    @templates = ManualTemplate.for_company(current_company_id).order(is_preset: :desc, created_at: :desc)
    @title = "テンプレート管理"
  end

  def show
    @title = @template.name
  end

  def new
    @template = ManualTemplate.new
    @title = "テンプレート新規作成"
  end

  def create
    @template = ManualTemplate.new(template_params)
    @template.company_id = current_company_id
    @template.created_by = current_user

    if @template.save
      redirect_to manual_templates_path, notice: "テンプレートが正常に作成されました。"
    else
      @title = "テンプレート新規作成"
      render :new, status: :unprocessable_entity
    end
  end

  def edit
    if @template.is_preset?
      redirect_to manual_templates_path, alert: "プリセットテンプレートは編集できません。複製して独自テンプレートとしてカスタマイズしてください。"
      return
    end
    @title = "テンプレート編集"
  end

  def update
    if @template.is_preset?
      redirect_to manual_templates_path, alert: "プリセットテンプレートは編集できません。"
      return
    end

    if @template.update(template_params)
      redirect_to manual_templates_path, notice: "テンプレートが正常に更新されました。"
    else
      @title = "テンプレート編集"
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    if @template.is_preset?
      redirect_to manual_templates_path, alert: "プリセットテンプレートは削除できません。"
      return
    end

    @template.destroy
    redirect_to manual_templates_path, notice: "テンプレートが正常に削除されました。"
  end

  def duplicate
    new_template = @template.dup
    new_template.name = "#{@template.name}（コピー）"
    new_template.is_preset = false
    new_template.company_id = current_company_id
    new_template.created_by = current_user

    if new_template.save
      redirect_to edit_manual_template_path(new_template), notice: "テンプレートを複製しました。"
    else
      redirect_to manual_templates_path, alert: "テンプレートの複製に失敗しました。"
    end
  end

  private

  def set_template
    @template = ManualTemplate.for_company(current_company_id).find(params[:id])
  end

  def template_params
    params.require(:manual_template).permit(:name, :description, :output_format, sections: [:name, :instruction])
  end
end
