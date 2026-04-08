module Confirmable
  extend ActiveSupport::Concern

  included do
    before_create :generate_confirmation_token
  end

  def confirmed?
    confirmed_at.present?
  end

  def confirm!
    return true if confirmed?

    update!(
      confirmed_at: Time.current,
      confirmation_token: nil
    )
  end

  def send_confirmation_instructions
    generate_confirmation_token! if confirmation_token.blank?
    update!(confirmation_sent_at: Time.current)
    ConfirmationMailer.confirmation_instructions(self).deliver_now
  end

  def resend_confirmation_instructions
    return false if confirmed?

    generate_confirmation_token!
    update!(confirmation_sent_at: Time.current)
    ConfirmationMailer.confirmation_instructions(self).deliver_now
    true
  end

  def confirmation_token_valid?
    return false if confirmation_token.blank?
    return false if confirmation_sent_at.blank?

    # Token expires after 24 hours
    confirmation_sent_at > 24.hours.ago
  end

  private

  def generate_confirmation_token
    self.confirmation_token = SecureRandom.urlsafe_base64(32)
  end

  def generate_confirmation_token!
    generate_confirmation_token
    save!
  end
end
