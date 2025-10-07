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
    prompt_template = load_prompt_template
    prompt_template.gsub('{industry}', industry)
                   .gsub('{problem}', problem)
                   .gsub('{role}', role)
  end

  def load_prompt_template
    prompt_path = Rails.root.join('app', 'prompts', 'business_improvement_prompt.txt')
    File.read(prompt_path)
  rescue => e
    raise Error, "プロンプトファイルの読み込みエラー: #{e.message}"
  end

  def parse_json_response(content)
    json_match = content.match(/\{.*\}/m)
    parsed_response = JSON.parse(json_match[0])
    
    # 新しいフォーマットでそのまま返却
    {
      'estimated_time_saving_rate' => parsed_response['estimated_time_saving_rate'],
      'difficulty_level' => parsed_response['difficulty_level'],
      'explanation' => parsed_response['explanation']
    }
  rescue JSON::ParserError => e
    raise Error, "JSON解析エラー: #{e.message}"
  end
end