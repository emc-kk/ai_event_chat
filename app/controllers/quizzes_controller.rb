class QuizzesController < ApplicationController
  def show
    render inertia: 'Quize/Show', props: {
      quizzes: Quiz.all.map(&:to_hash)
    }
  end

  def create
    # Here you would typically handle the quiz submission logic.
    # For demonstration, we'll just redirect back to the show page.
    redirect_to quize_path, notice: 'Quiz submitted successfully!'
  end
end