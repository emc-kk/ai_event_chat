class AiServerClient
  BASE_URL = ENV.fetch('AI_SERVER_URL_FROM_CONTAINER', 'http://ai-server:3000')
  API_SECRET_KEY = ENV.fetch('AI_SERVER_API_SECRET_KEY', '')

  def self.connection
    @connection ||= Faraday.new(url: BASE_URL) do |faraday|
      faraday.request :json
      faraday.response :json, parser_options: { symbolize_names: true }
      faraday.adapter Faraday.default_adapter
      faraday.options.timeout = 120
      faraday.options.open_timeout = 10
      faraday.headers['x-api-key'] = API_SECRET_KEY
    end
  end

  def self.get_qa_data(request_id)
    response = connection.get('/api/knowledge-hearing-qa', { request_id: request_id })

    if response.success?
      response.body
    else
      Rails.logger.error "Failed to fetch QA data: #{response.status} - #{response.body}"
      { data: [], total: 0 }
    end
  rescue Faraday::Error => e
    Rails.logger.error "AI Server connection error: #{e.message}"
    { data: [], total: 0 }
  end
end
