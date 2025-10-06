class OpenaiClient
  Error = Class.new(StandardError)

  class << self
    def predict(industry:, problem:, role:)
      new.predict_time_savings(industry: industry, problem: problem, role: role)
    end
  end

  def initialize
    @client = OpenAI::Client.new(access_token: api_key)
  end

  def predict_time_savings(industry:, problem:, role:)
    prompt = build_prompt(industry: industry, problem: problem, role: role)
    
    response = @client.chat(
      parameters: {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      }
    )

    content = response.dig('choices', 0, 'message', 'content')
    
    parse_json_response(content)
  rescue => e
    raise Error, "OpenAI API error: #{e.message}"
  end

  private

  def api_key
    ENV['OPENAI_API_KEY']
  end

  def build_prompt(industry:, problem:, role:)
    <<~PROMPT
      あなたは業務改善コンサルタントです。
      以下の情報をもとに、AI（生成AI、OCR、RPAなど）を活用した場合に、
      どのくらい業務時間を削減できるかを予測してください。
      また、その理由を簡潔に説明してください。
      【業界】#{industry}
      【課題】#{problem}
      【役割】#{role}
      出力フォーマット（厳守）：json
      ---
      {
        "estimated_time_savings": "",
        "explanation": ""
      }
      ---
    PROMPT
  end

  def parse_json_response(content)
    json_match = content.match(/\{.*\}/m)

    JSON.parse(json_match[0])
  rescue JSON::ParserError => e
    raise Error, "JSON解析エラー: #{e.message}"
  end
end