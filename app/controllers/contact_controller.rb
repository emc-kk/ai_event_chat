class ContactController < ApplicationController
  def show
    render inertia: 'Contact/Show'
  end
end