class Topic < ApplicationRecord
  include Permissible

  # Associations
  belongs_to :company, foreign_key: :company_id, primary_key: :id, optional: true
  belongs_to :created_by, polymorphic: true
  belongs_to :folder, class_name: "TopicFolder", optional: true
  has_many :requests, dependent: :destroy
  has_many :messages, dependent: :destroy
  has_many :rooms, dependent: :destroy
  has_one :manual, dependent: :destroy
  has_many :comparison_sessions, dependent: :destroy
  has_many :topic_data_source_links, dependent: :destroy
  has_many :data_source_files, through: :topic_data_source_links

  # Validations
  validates :name, presence: true, length: { maximum: 255 }
  validates :description, presence: true

  # Soft delete
  acts_as_paranoid

  # Scopes
  scope :for_company, ->(company_id) { where(company_id: company_id) }
  scope :in_folder, ->(folder_id) { where(folder_id: folder_id) }
  scope :at_root, -> { where(folder_id: nil) }

  enum :status, { not_started: 0, in_progress: 1, completed: 2 }, prefix: true
  enum :icon_color, {
    yellow: 0,
    blue: 1,
    orange: 2,
    green: 3,
    lightgreen: 4,
    red: 5,
  }, prefix: true

  def self.ransackable_attributes(auth_object = nil)
    %w[name created_by_id uuid company_id folder_id created_at]
  end
  
  def update_status
    new_status = calculate_status_from_requests
    update_column(:status, self.class.statuses[new_status]) if status != new_status.to_s
  end

  def chat_accessible?
    status_completed? && (comparison_sessions.empty? || comparison_sessions.all?(&:status_completed?))
  end

  private

    def permission_parent
      folder
    end

    def calculate_status_from_requests
      # リクエストが0個の場合は「未着手」
      return 'not_started' if requests.empty?
      
      # 全てのリクエストが完了している場合は「完了」
      if requests.all? { |request| request.status_completed? }
        return 'completed'
      end
      
      # それ以外（リクエストが1個以上で、未完了のものがある）場合は「進行中」
      'in_progress'
    end
end
