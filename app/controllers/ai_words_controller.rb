class AiWordsController < ApplicationController
  def index
    render inertia: 'AiWords/Index', props: {
      words: AiWord.all.map(&:to_hash)
    }
  end
end