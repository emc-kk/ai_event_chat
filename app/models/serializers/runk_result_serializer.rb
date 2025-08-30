class Serializers::RunkResultSerializer < ActiveModel::Serializer
  attributes :id, :completion_time, :correct_count, :answers, :score

  class << self
    def serialize(runk_result)
      new(runk_result).as_json
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