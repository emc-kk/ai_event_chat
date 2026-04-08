class Admin < ApplicationRecord
  include Confirmable

  attr_accessor :password_change_required

  # Associations
  belongs_to :company, foreign_key: :company_id, primary_key: :id, optional: true
  has_many :created_users, as: :creator, class_name: "User"
  has_many :created_topic_folders, as: :created_by, class_name: "TopicFolder"
  has_many :created_topics, as: :created_by, class_name: "Topic"
  has_many :created_data_source_folders, as: :created_by, class_name: "DataSourceFolder"
  has_many :created_data_source_files, as: :created_by, class_name: "DataSourceFile"
  has_many :created_requests, as: :created_by, class_name: "Request"
  has_many :permissions, as: :grantee, dependent: :destroy
  has_many :granted_permissions, class_name: "Permission", foreign_key: :granted_by_id, dependent: :nullify

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :privileged, -> { where(company_id: nil) }

  has_secure_password

  VALID_EMAIL_REGEX = /\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)+\z/i
  VALID_PASSWORD_REGEX = /\A(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}\z/
  # Validations
  validates :password, format: { with: VALID_PASSWORD_REGEX, message: :password }, if: :should_validate_password?
  validates :email, presence: true, format: { with: VALID_EMAIL_REGEX, message: "の形式が正しくありません" }, uniqueness: true, length: { maximum: 255 }
  validates :name, presence: true, length: { maximum: 255 }

  # safe_attributes :email, :name, :password, :password_confirmation, :note, :session_token

  # enum status: { inactive: 0, active: 1 }, _prefix: true

  scope :find_by_email_or_username, -> (account) {
    where("email = :account", account: account)
  }

  def self.ransackable_attributes(auth_object = nil)
    %w[email name status company_id]
  end

  def privileged?
    company_id.nil?
  end

  def authenticate(password)
    return false if password_digest.blank?

    BCrypt::Password.new(password_digest).is_password?(password)
  end

  def status_name
    I18n.t("activerecord.attributes.user.statuses.#{status}", default: "")
  end

  def get_session_token
    set_session_token if session_token.blank?
    session_token
  end

  def set_session_token
    update(session_token: SecureRandom.hex(16))
  end

  private
    def should_validate_password?
      password_change_required == true
    end
end
