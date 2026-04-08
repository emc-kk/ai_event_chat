class Api::GlossaryTermsController < ApplicationController
  before_action :require_company_context
  before_action :set_glossary_term, only: [:update, :destroy]
  before_action :require_editor, only: [:create, :update, :destroy, :import]

  # GET /api/glossary_terms
  def index
    terms = CompanyGlossaryTerm.for_company(current_company_id).includes(:created_by, :updated_by).ordered
    render json: terms.map { |t| term_json(t) }
  end

  # POST /api/glossary_terms
  def create
    term = CompanyGlossaryTerm.new(term_params)
    term.company_id = current_company_id
    term.created_by = current_user
    term.created_by_type = current_user_type

    if term.save
      render json: term_json(term), status: :created
    else
      render json: { errors: term.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /api/glossary_terms/:id
  def update
    @glossary_term.assign_attributes(term_params)
    @glossary_term.updated_by = current_user
    @glossary_term.updated_by_type = current_user_type

    if @glossary_term.save
      render json: term_json(@glossary_term)
    else
      render json: { errors: @glossary_term.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/glossary_terms/:id
  def destroy
    @glossary_term.destroy!
    head :no_content
  end

  # POST /api/glossary_terms/import
  def import
    file = params[:file]
    unless file.present?
      render json: { error: "CSVファイルを選択してください" }, status: :unprocessable_entity
      return
    end

    require "csv"

    results = { created: 0, skipped: 0, errors: [] }

    begin
      content = file.read.force_encoding("UTF-8")
      content = content.encode("UTF-8", "Shift_JIS") unless content.valid_encoding?

      csv = CSV.parse(content, headers: true, skip_blanks: true)

      unless csv.headers.include?("term") && csv.headers.include?("definition")
        render json: { error: "CSVにはterm, definitionヘッダーが必要です。テンプレートをダウンロードしてご利用ください。" }, status: :unprocessable_entity
        return
      end

      csv.each_with_index do |row, idx|
        term_value = row["term"].to_s.strip
        definition_value = row["definition"].to_s.strip
        term_group_value = row["term_group"].to_s.strip.presence

        if term_value.blank? || definition_value.blank?
          results[:skipped] += 1
          next
        end

        existing = CompanyGlossaryTerm.find_by(company_id: current_company_id, term: term_value)
        if existing
          existing.update(definition: definition_value, term_group: term_group_value, updated_by: current_user, updated_by_type: current_user_type)
          results[:skipped] += 1
        else
          term = CompanyGlossaryTerm.new(
            term: term_value,
            definition: definition_value,
            term_group: term_group_value,
            company_id: current_company_id,
            created_by: current_user,
            created_by_type: current_user_type
          )
          if term.save
            results[:created] += 1
          else
            results[:errors] << "行#{idx + 2}: #{term.errors.full_messages.join(', ')}"
          end
        end
      end

      render json: results
    rescue CSV::MalformedCSVError => e
      render json: { error: "CSVの形式が不正です: #{e.message}" }, status: :unprocessable_entity
    end
  end

  # GET /api/glossary_terms/match?q=xxx
  def match
    results = CompanyGlossaryTerm.match_terms(current_company_id, params[:q].to_s.delete("\u0000"))
    render json: results.map { |t| { term: t.term, definition: t.definition } }
  end

  private

  def set_glossary_term
    @glossary_term = CompanyGlossaryTerm.find_by!(id: params[:id], company_id: current_company_id)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "用語が見つかりません" }, status: :not_found
  end

  def term_params
    permitted = params.require(:glossary_term).permit(:term, :definition, :term_group)
    permitted[:term] = permitted[:term].to_s.delete("\u0000") if permitted[:term].present?
    permitted[:definition] = permitted[:definition].to_s.delete("\u0000") if permitted[:definition].present?
    permitted[:term_group] = permitted[:term_group].to_s.delete("\u0000") if permitted[:term_group].present?
    permitted
  end

  def current_user_type
    current_admin? ? "Admin" : "User"
  end

  def require_editor
    unless user_can_edit_glossary?
      render json: { error: "編集権限がありません" }, status: :forbidden
    end
  end

  def require_company_context
    unless current_company_id.present?
      render json: { error: "会社コンテキストが必要です" }, status: :forbidden
    end
  end

  def term_json(term)
    {
      id: term.id,
      term: term.term,
      definition: term.definition,
      term_group: term.term_group,
      created_by_type: term.created_by_type,
      created_by_name: term.created_by&.name,
      updated_by_name: term.updated_by&.name,
      created_at: term.created_at,
      updated_at: term.updated_at
    }
  end
end
