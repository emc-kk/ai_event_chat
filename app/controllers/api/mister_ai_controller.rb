class Api::MisterAiController < ApplicationController
  def diagnose
    result = openai_predict!

    hubspot_submit!(result)

    render json: {
      success: true,
      estimated_time_savings: result['estimated_time_savings'],
      explanation: result['explanation']
    }
  rescue OpenaiClient::Error => e
    render json: {
      success: false,
      error: "診断エラー: #{e.message}"
    }, status: :unprocessable_entity
  rescue => e
    render json: {
      success: false,
      error: "予期しないエラーが発生しました"
    }, status: :internal_server_error
  end

  private

  def diagnose_params
    params.permit(:industry, :problem, :role, :email)
  end

  def openai_predict!
    OpenaiClient.predict(
      industry: params[:industry],
      problem: params[:problem],
      role: params[:role]
    )
  end

  def hubspot_submit!(result)
    HubspotOpsForm.submit!(
      email: params[:email],
      industry: params[:industry],
      problem: params[:problem],
      role: params[:role],
      answer: result.to_json
    )
  end
end