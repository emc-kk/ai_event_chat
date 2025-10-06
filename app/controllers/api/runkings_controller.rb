class Api::RunkingsController < ApplicationController
  def create
    quiz_result = QuizResult.new({ quiz: :default }.merge(runking_params))

    ActiveRecord::Base.transaction do
      quiz_result.save!
      HubspotQuizForm.submit!(quiz_result: quiz_result)
    end

    render json: {
      id: quiz_result.id,
      runking: quiz_result.runking,
      score: quiz_result.score_grade,
      surrounding: QuizResult.surrounding(quiz_result).map(&:to_json),
      total: QuizResult.total_participants(quiz_result.quiz)
    }, status: :created
  rescue StandardError => e
    render json: { errors: "サーバーエラーが発生しました" }, status: :unprocessable_entity
  end

  private

  def runking_params
    params.permit(:completion_time, :correct_count, :email, answers: []).to_h
  end

  def hubspot_submit(quiz_result)
    HubspotForm.call(quiz_result: quiz_result)
  end
end