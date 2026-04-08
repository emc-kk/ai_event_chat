class Room < ApplicationRecord
  # Associations
  belongs_to :request, optional: true
  belongs_to :request_content, optional: true
  belongs_to :topic, optional: true

  # Validations
  validates :chat_type, presence: true, inclusion: { in: %w[hearing topic] }
  validates :is_finished, inclusion: { in: [true, false] }
  validates :is_deleted, inclusion: { in: [true, false] }
  validate :must_have_request_or_topic

  # Scopes
  scope :hearing, -> { where(chat_type: 'hearing') }
  scope :topic, -> { where(chat_type: 'topic') }
  scope :active, -> { where(is_deleted: false) }
  scope :finished, -> { where(is_finished: true) }
  scope :unfinished, -> { where(is_finished: false) }

  # Class Methods
  def self.find_existing_for_chat(parent, chat_type, request_content_id = nil)
    scope = parent.rooms.where(chat_type: chat_type).active

    if request_content_id.present?
      scope.where(request_content_id: request_content_id).order(created_at: :desc).first
    else
      scope.where(request_content_id: nil).order(created_at: :desc).first
    end
  end

  def self.find_or_create_for_chat(parent, chat_type, request_content_id = nil)
    # For hearing with rehearing status, always create new room
    if chat_type == 'hearing' && parent.is_a?(Request) && parent.status_rehearing?
      existing_unfinished = parent.rooms.hearing.active.unfinished
                                  .where(request_content_id: request_content_id)
                                  .order(created_at: :desc).first
      return existing_unfinished if existing_unfinished

      topic_id = parent.topic_id
      return parent.rooms.create!(
        chat_type: chat_type,
        request_content_id: request_content_id,
        topic_id: topic_id,
        is_finished: false,
        is_deleted: false
      )
    end

    # For all other cases, return existing room (finished or unfinished)
    existing = find_existing_for_chat(parent, chat_type, request_content_id)
    return existing if existing

    # Create new room only if no existing room found
    topic_id = parent.is_a?(Topic) ? parent.id : parent.topic_id

    parent.rooms.create!(
      chat_type: chat_type,
      request_content_id: request_content_id,
      topic_id: topic_id,
      is_finished: false,
      is_deleted: false
    )
  end

  # Instance Methods
  def hearing?
    chat_type == 'hearing'
  end

  def topic?
    chat_type == 'topic'
  end

  private

  def must_have_request_or_topic
    if request_id.blank? && topic_id.blank?
      errors.add(:base, 'request_id または topic_id のいずれかが必要です')
    end
  end
  
  def active?
    !is_deleted
  end
  
  def finished?
    is_finished
  end
  
  def finish!
    update!(is_finished: true)
  end
  
  def soft_delete!
    update!(is_deleted: true)
  end
  
  def restore!
    update!(is_deleted: false)
  end
end
