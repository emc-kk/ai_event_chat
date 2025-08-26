# app/models/quiz.rb
class Quiz
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :id, :integer
  attribute :question, :string
  attribute :options
  attribute :correct_answer, :integer
  attribute :explanation, :string

  class << self
    def all
      @all ||= load_quizzes
    end

    def find(id)
      all.find { |quiz| quiz.id == id.to_i }
    end

    def load_quizzes
      config = Rails.application.config_for(:quizzes)
      config['quizzes'].map do |quiz_data|
        new(quiz_data)
      end
    end
  end

  def correct_answer?(answer)
    answer.to_i == correct_answer
  end

  def options
    super || []
  end

  def options=(value)
    super(Array(value))
  end

  def to_hash
    {
      id: id,
      question: question,
      options: options,
      correct_answer: correct_answer,
      explanation: explanation
    }
  end
end