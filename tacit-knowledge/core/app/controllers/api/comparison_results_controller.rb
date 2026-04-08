class Api::ComparisonResultsController < ApplicationController
  skip_before_action :login_check
  skip_before_action :verify_authenticity_token

  def create
    session = ComparisonSession.find(params[:id])

    elements_data = params[:elements] || []

    ComparisonElement.transaction do
      elements_data.each do |elem|
        session.comparison_elements.create!(
          classification: elem[:classification],
          knowledge_element: elem[:knowledge_element],
          responses: elem[:responses]
        )
      end

      consensus_count = session.comparison_elements.consensus.count
      total = session.comparison_elements.count
      rate = total > 0 ? consensus_count.to_f / total : 0

      session.update!(
        status: :in_review,
        consensus_rate: rate
      )
    end

    render json: { success: true }
  rescue => e
    Rails.logger.error "Comparison results error: #{e.message}"
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
