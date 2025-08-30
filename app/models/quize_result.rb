class QuizeResult < ApplicationRecord
  validates :quize, presence: true
  validates :completion_time, presence: true
  validates :correct_count, presence: true
  validates :answers, presence: true

  serialize :answers, JSON

  enum :quize, {
    default: 0
  }, prefix: true

  def runking
    # 同じクイズの結果を取得し、正解数降順、完了時間昇順でソート
    same_quiz_results = QuizeResult.where(quize: self.quize)
                                   .order(correct_count: :desc, completion_time: :asc)
    
    # 自分より上位の結果の数を数える + 1 が順位
    better_results_count = same_quiz_results.where(
      "(correct_count > ? OR (correct_count = ? AND completion_time < ?))",
      self.correct_count,
      self.correct_count,
      self.completion_time
    ).count
    
    better_results_count + 1
  end

  def total_participants
    QuizeResult.where(quize: self.quize).count
  end

  def score
    case correct_count
    when 9..10
      "S"
    when 7..8
      "A"
    when 5..6
      "B"
    when 3..4
      "C"
    else
      "D"
    end
  end
end