Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  root "home#index"
  resources :quizzes, only: %i[index]
  resources :ai_words, only: %i[index]
  resource :contact, only: %i[show], controller: :contact
  resource :mister_ai, only: %i[show], controller: :mister_ai
  namespace :api do
    resources :runkings, only: %i[create]
    resources :contact_submissions, only: %i[create]
    resource :mister_ai, only: [], controller: 'mister_ai' do
      post :diagnose, on: :member
    end
  end
end
