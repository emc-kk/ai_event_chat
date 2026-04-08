class CompanyGlossaryTerm < ApplicationRecord
  include UlidPk

  # Associations
  belongs_to :company
  belongs_to :created_by, polymorphic: true
  belongs_to :updated_by, polymorphic: true, optional: true

  # Validations
  validates :term, presence: true, length: { maximum: 255 },
                   uniqueness: { scope: :company_id, message: "は既に登録されています" }
  validates :definition, presence: true

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :ordered, -> { order(:term) }
  scope :matching, ->(query) {
    where(company_id: query[:company_id])
      .where("term IN (?)", extract_terms(query[:text]))
  }

  # クエリテキストから用語を完全一致検索
  def self.match_terms(company_id, text)
    return [] if company_id.blank? || text.blank?

    terms = for_company(company_id).pluck(:term).map { |t| t.force_encoding("UTF-8") }
    matched = terms.select { |t| text.force_encoding("UTF-8").include?(t) }
    return [] if matched.empty?

    for_company(company_id).where(term: matched).ordered
  end

  def self.ransackable_attributes(auth_object = nil)
    %w[term definition term_group]
  end

  private

  def self.extract_terms(text)
    return [] if text.blank?
    for_company(nil).none # fallback, use match_terms instead
  end
end
