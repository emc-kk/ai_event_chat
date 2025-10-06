class HubspotOpsForm
  class << self
    def submit!(email:, industry:, problem:, role:, answer:)
      new.submit(email: email, industry: industry, problem: problem, role: role, answer: answer)
    end
  end

  def submit(email:, industry:, problem:, role:, answer:)
    body = build_form_data(email: email, industry: industry, problem: problem, role: role, answer: answer)

    hubspot_client.post("#{portal_id}/#{form_guid}") do |req|
      req.body = body.to_json
    end
  end

  private

  def hubspot_client
    @hubspot_client ||= HubspotClient.new
  end

  def portal_id
    '243885354'
  end

  def form_guid
    '463551ac-9631-4ee1-a635-31ab69b9af33'
  end

  def build_form_data(email:, industry:, problem:, role:, answer:)
    field_mapping = {
      "email" => email,
      "aiexpo_industry" => industry,
      "aiexpo_issue" => problem,
      "aiexpo_role" => role,
      "aiexpo_answer" => answer
    }

    fields = field_mapping.map do |name, value|
      {
        objectTypeId: "0-1",
        name: name,
        value: value
      }
    end
    
    {
      submittedAt: Time.current.to_i * 1000,
      fields: fields
    }
  end
end
