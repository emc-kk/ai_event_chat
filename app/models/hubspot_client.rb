class HubspotClient
  BASE_URL = 'https://api.hsforms.com/submissions/v3/integration/secure/submit'

  def initialize
    @connection = connection
  end

  def post(path, &block)
    @connection.post(path, &block)
  end

  def connection
    Faraday.new(BASE_URL) do |conn|
      conn.request :json
      conn.response :json
      conn.headers['Authorization'] = "Bearer #{api_token}"
      conn.headers['Content-Type'] = 'application/json'
      conn.response :raise_error
    end
  end

  def api_token
    token = ENV['HUBSPOT_API_TOKEN']
  end
end
