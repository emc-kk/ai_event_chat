class Api::RunkingsController < ApplicationController
  def create
    runking = QuizeResult.new({ quize: :default }.merge(runking_params))

    if runking.save
      render json: Serializers::RunkResultSerializer.new(runking).to_json, status: :created
    else
      render json: { errors: runking.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def runking_params
    params.permit(:completion_time, :correct_count, answers: []).to_h
  end
end