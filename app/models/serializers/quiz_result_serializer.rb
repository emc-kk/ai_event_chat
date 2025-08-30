class Serializers::QuizResultSerializer < ActiveModel::Serializer
  attributes :id, :quiz, :completion_time, :correct_count, :answers, :score

  class << self
    def serialize(quiz_result)
      new(quiz_result).as_json
    end
  end

  def total
    object.total_participants
  end

  def runking
    object.ranking
  end

  def score
    object.score
  end
end