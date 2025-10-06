class HubspotForm
  Error = Class.new(StandardError)

  BASE_URL = 'https://api.hsforms.com/submissions/v3/integration/secure/submit'

  class << self
    def submit!(quiz_result:)
      new.submit(quiz_result)
    end
  end

  def submit(quiz_result)
    body = build_form_data(quiz_result)

    connection.post("#{portal_id}/#{form_guid}") do |req|
      req.body = body.to_json
    end
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

  def portal_id
    '243885354'
  end

  def form_guid
    '8c90be30-f27c-43b4-889a-359f08ba5b31'
  end

  def build_form_data(quiz_result)
    fields = []
    
    fields << {
      objectTypeId: "0-1",
      name: "email",
      value: quiz_result.email
    }
    fields << {
      objectTypeId: "0-1", 
      name: "quiz_score",
      value: quiz_result.correct_count
    }
    Quiz.all.each_with_index do |quiz, index|
      question_number = index + 1
      answer = quiz_result.answers[index]
      
      fields << {
        objectTypeId: "0-1",
        name: "quiz_q#{question_number}",
        value: quiz.question
      }
      fields << {
        objectTypeId: "0-1",
        name: "quiz_a#{question_number}",
        value: answer
      }
    end
    
    {
      submittedAt: Time.current.to_i * 1000,
      fields: fields
    }
  end
end
