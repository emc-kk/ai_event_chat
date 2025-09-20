class QuizzesController < ApplicationController
  def index
    render inertia: 'Quizzes/Index', props: {
      quizzes: Quiz.all.map(&:to_hash)
    }
  end
end