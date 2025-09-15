class PopulateQuizResultsScore < ActiveRecord::Migration[7.1]
  def up
    # 既存のレコードに対してscoreを計算して設定
    QuizResult.find_each do |quiz_result|
      if quiz_result.correct_count == 0
        score = -quiz_result.completion_time
      else
        score = quiz_result.correct_count * 1000000 - quiz_result.completion_time
      end
      quiz_result.update_column(:score, score)
    end
  end

  def down
    # rollback時はscoreをnullに戻す
    QuizResult.update_all(score: nil)
  end
end