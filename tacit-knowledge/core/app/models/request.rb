class Request < ApplicationRecord
  
  # Associations
  belongs_to :topic
  belongs_to :respondent, class_name: "User", optional: true
  belongs_to :created_by, polymorphic: true
  has_many :messages, dependent: :destroy
  has_many :request_contents, dependent: :destroy
  has_many :request_documents, dependent: :destroy
  has_many :request_data_source_links, dependent: :destroy
  has_many :data_source_files, through: :request_data_source_links
  has_many :rooms, dependent: :destroy
  has_many :hearing_suggestions, dependent: :destroy
  has_one :hearing_step_state, dependent: :destroy
  has_many :hearing_extracts, dependent: :destroy
  has_many :bias_flags, dependent: :destroy

  # Callbacks
  after_save :update_status_topic, if: :saved_change_to_status?
  
  # Upload
  accepts_nested_attributes_for :request_contents, allow_destroy: true
  accepts_nested_attributes_for :request_documents, allow_destroy: true
  
  attr_accessor :new_document_files

  # Soft delete
  acts_as_paranoid

  enum :status, { not_started: 0, inhearing: 1, awaiting_verification: 2, in_verification: 3, rehearing: 4, completed: 5, deleted: 6, updating: 7, error: 8 }, prefix: true
  enum :request_type, { hearing: 0, manual: 1 }, prefix: true

  scope :hearing_type, -> { where(request_type: :hearing) }

  scope :status_except, ->(*excluded_statuses) {
    excluded_values = excluded_statuses.flatten.map { |s| statuses[s] }
    where.not(status: excluded_values)
  }

  scope :status_history, -> { where(status: [:completed, :awaiting_verification]) }
  scope :generally_accessible, -> { where(status: [:awaiting_verification, :completed]) }

  def self.ransackable_attributes(auth_object = nil)
    %w[
      created_by_id
      status
      respondent_id
      room_id
      request_type
    ]
  end

  def self.ransackable_associations(auth_object = nil)
    ["topic"]
  end

  def update_status_topic
    topic.update_status
  end

  def generally_access?
    # 矛盾確認中・完了済みの状態であれば誰でもアクセス可能
    status_awaiting_verification? || status_completed?
  end

  def has_pending_conflicts?
    CrossUserConflict.involving_request(id).pending.exists?
  end

  # ナレッジ作成中（updating）のまま一定時間経過したリクエストを自動回復
  # SQS/Workerが未稼働・失敗した場合のフォールバック
  def self.recover_stuck_updating(timeout: 5.minutes)
    stuck = where(status: :updating).where("updated_at < ?", timeout.ago)
    count = stuck.count
    return 0 if count.zero?

    stuck.find_each do |req|
      # ヒアリングが未開始（rooms がない or inhearing に未到達）なら not_started に戻す
      # それ以外は awaiting_verification に進める
      next_status = req.rooms.hearing.any? ? :completed : :not_started
      req.update(status: next_status)
      Rails.logger.info "Auto-recovered stuck request #{req.id} from updating to #{next_status}"
    end
    count
  end

  private
end
