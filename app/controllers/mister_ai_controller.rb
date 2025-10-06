class MisterAiController < ApplicationController
  def show
    render inertia: 'MisterAi/Show'
  end
end