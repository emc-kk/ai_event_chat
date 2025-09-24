class ContactSubmission < ApplicationRecord
  validates :company_name, presence: true, length: { maximum: 255 }
  validates :email, presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :interested_services, presence: true
  validates :service_ids, presence: true

  # JSONカラムのバリデーション
  validate :interested_services_must_be_array
  validate :service_ids_must_be_array
  validate :service_arrays_must_match_length

  def to_json
    {
      id: id,
      company_name: company_name,
      email: email,
      interested_services: interested_services,
      service_ids: service_ids,
      created_at: created_at
    }
  end

  private

  def interested_services_must_be_array
    unless interested_services.is_a?(Array)
      errors.add(:interested_services, 'must be an array')
    end
  end

  def service_ids_must_be_array
    unless service_ids.is_a?(Array)
      errors.add(:service_ids, 'must be an array')
    end
  end

  def service_arrays_must_match_length
    if interested_services.is_a?(Array) && service_ids.is_a?(Array)
      unless interested_services.length == service_ids.length
        errors.add(:base, 'interested_services and service_ids must have the same length')
      end
    end
  end
end