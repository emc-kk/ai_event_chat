# app/models/ai_word.rb
class AiWord
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :id, :integer
  attribute :title, :string
  attribute :description, :string
  attribute :category, :string

  class << self
    def all
      @all ||= load_words
    end

    def find(id)
      all.find { |word| word.id == id.to_i }
    end

    private

    def load_words
      config = Rails.application.config_for(:ai_words)
      words = []

      config[:categories].each do |category_data|
        category_name = category_data[:category]
        category_words = category_data[:words]
        
        category_words.each do |word_data|
          words << new(
            id: word_data[:id],
            title: word_data[:word_title],
            description: word_data[:description],
            category: category_name
          )
        end
      end
      
      words
    end
  end

  def to_hash
    {
      id: id,
      title: title,
      description: description,
      category: category
    }
  end
end
