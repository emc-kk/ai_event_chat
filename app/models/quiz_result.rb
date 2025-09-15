class QuizResult < ApplicationRecord
  validates :quiz, presence: true
  validates :completion_time, presence: true
  validates :correct_count, presence: true
  validates :answers, presence: true

  attr_reader :runking

  # 保存前にscoreを自動計算
  before_save :calculate_score

  enum :quiz, {
    default: 0
  }, prefix: true

  class << self
    def surrounding(quiz_result)
      quiz = quiz_result.quiz
      target_score = quiz_result.score

      same_quiz_results = where(quiz: quiz)
      
      # 自分より上位の2名（スコアが高い）
      upper_results = same_quiz_results
                      .where('score > ?', target_score)
                      .order(score: :asc)
                      .limit(2)
                      .to_a
                      .reverse # 自分に近い順に

      # 自分より下位の2名（スコアが低い）  
      lower_results = same_quiz_results
                      .where('score < ?', target_score)
                      .order(score: :desc)
                      .limit(4 - upper_results.size) # 上位が2名未満の場合に対応
                      .to_a

      # 結果をまとめる（前2名 + 自分 + 後2名）
      upper_results + [quiz_result] + lower_results
    end

    def total_participants(quiz_type)
      where(quiz: quiz_type).count
    end
  end

  def runking
    @runking ||= QuizResult.where(quiz: self.quiz)
                          .where('score > ?', self.score)
                          .count + 1
  end

  def score_grade
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

  def to_json
    {
      id: id,
      runking: runking,
      score: score,
      correct_count: correct_count,
      completion_time: completion_time,
    }
  end

  private

  def calculate_score
    self.score = calculate_ranking_score
  end

  def calculate_ranking_score
    if self.correct_count == 0
      score = -self.completion_time
    else
      score = self.correct_count * 1000000 - self.completion_time
    end
  end
end