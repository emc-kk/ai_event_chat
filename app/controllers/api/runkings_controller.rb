class Api::RunkingsController < ApplicationController
  def create
    quiz_result = QuizResult.new({ quiz: :default }.merge(runking_params))

    if quiz_result.save
      render json: quiz_result.to_json, status: :created
    else
      render json: { errors: quiz_result.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def runking_params
    params.permit(:completion_time, :correct_count, answers: []).to_h
  end
end