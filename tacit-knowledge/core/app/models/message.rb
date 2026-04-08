class Message < ApplicationRecord
  belongs_to :topic, optional: true
  belongs_to :request, optional: true

  belongs_to :question, class_name: 'Message', foreign_key: 'question_id', optional: true
  has_many :user_responses, class_name: 'Message', foreign_key: 'question_id', dependent: :nullify
  has_many :hearing_extracts, foreign_key: 'source_message_id', dependent: :nullify
  has_many :bias_flags, foreign_key: 'source_message_id', dependent: :nullify

  enum :message_type, { assistant: 0, user: 1 }, prefix: true
  # validation: 1 は廃止済み（既存データ互換のため残す）
  enum :chat_type, { hearing: 0, validation: 1, topic: 2 }, prefix: true
end
