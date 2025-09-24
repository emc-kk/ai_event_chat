class Api::ContactSubmissionsController < ApplicationController
  def create
    contact_submission = ContactSubmission.new(contact_submission_params)

    if contact_submission.save
      render json: {
        id: contact_submission.id,
        message: 'Contact submission saved successfully',
        data: contact_submission.to_json
      }, status: :created
    else
      render json: { 
        errors: contact_submission.errors.full_messages 
      }, status: :unprocessable_entity
    end
  end

  private

  def contact_submission_params
    params.permit(:company_name, :email, interested_services: [], service_ids: [])
  end
end