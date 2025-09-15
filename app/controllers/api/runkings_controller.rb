class Api::RunkingsController < ApplicationController
  def create
    quiz_result = QuizResult.new({ quiz: :default }.merge(runking_params))

    if quiz_result.save
      render json: {
        id: quiz_result.id,
        runking: quiz_result.runking,
        score: quiz_result.score_grade,
        surrounding: QuizResult.surrounding(quiz_result),
        total: QuizResult.total_participants(quiz_result.quiz)
      }, status: :created
    else
      render json: { errors: quiz_result.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def runking_params
    params.permit(:completion_time, :correct_count, answers: []).to_h
  end
end