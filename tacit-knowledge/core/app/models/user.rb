class User < ApplicationRecord
  include Confirmable

  attr_accessor :password_change_required

  # Associations
  belongs_to :company, foreign_key: :company_id, primary_key: :id, optional: true
  has_many :requests, foreign_key: :respondent_id, inverse_of: :respondent
  belongs_to :creator, polymorphic: true
  has_many :created_users, as: :creator, class_name: "User"
  has_many :created_topic_folders, as: :created_by, class_name: "TopicFolder"
  has_many :created_topics, as: :created_by, class_name: "Topic"
  has_many :created_data_source_folders, as: :created_by, class_name: "DataSourceFolder"
  has_many :created_data_source_files, as: :created_by, class_name: "DataSourceFile"
  has_many :created_requests, as: :created_by, class_name: "Request"
  has_many :permissions, as: :grantee, dependent: :destroy
  has_many :user_group_memberships, dependent: :destroy
  has_many :user_groups, through: :user_group_memberships

  # ユーザーが所属するグループのID一覧（リクエスト単位でキャッシュ）
  def user_group_ids
    @user_group_ids ||= user_group_memberships.pluck(:user_group_id)
  end

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }

  has_secure_password validations: false # Disable default validations to use custom ones

  VALID_EMAIL_REGEX = /\A[\w+\-.]+@[a-z\d\-]+(\.[a-z\d\-]+)+\z/i
  VALID_PASSWORD_REGEX = /\A(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}\z/

  # Validations
  validates :password, presence: { message: "を入力してください" }, if: :should_validate_password?
  validates :password, format: { with: VALID_PASSWORD_REGEX, message: "は8文字以上で、大文字・小文字・数字・記号を含む必要があります" }, if: :should_validate_password?
  validates :password, confirmation: { message: "が一致しません" }, if: :should_validate_password?
  validates :password_confirmation, presence: { message: "を入力してください" }, if: :should_validate_password?

  validates :email, presence: true, format: { with: VALID_EMAIL_REGEX, message: "の形式が正しくありません" }, uniqueness: true, length: { maximum: 255 }
  validates :name, presence: true, length: { maximum: 255 }

  validates :creator, presence: true

  # safe_attributes :email, :name, :password, :password_confirmation, :note, :session_token

  # Soft delete
  acts_as_paranoid

  # enum status: { inactive: 0, active: 1 }, _prefix: true

  enum :role, {
    # 一般
    general: 0,
    # ベテラン
    veteran: 1,
    # 管理者
    company_admin: 9
  }, prefix: true
  validates :role, presence: true, inclusion: { in: roles.keys }

  scope :find_by_email_or_username, -> (account) {
    where("email = :account", account: account)
  }

  scope :find_veterans, -> { role_veteran }

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
