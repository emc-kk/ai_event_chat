Rails.application.routes.draw do
  resources :companies
  resources :admins do
    member do
      patch :confirm
      patch :resend_confirmation
    end
  end
  resources :requests do
    delete :remove_document, on: :member
    get :hearing, on: :member
    resources :request_contents, only: [:create]
  end
  resources :topic_folders, only: [:create, :update, :destroy] do
    patch :move, on: :member
  end
  resources :permissions, only: [:index, :create, :update, :destroy]

  resources :manual_templates do
    post :duplicate, on: :member
  end

  resources :topics do
    get :chat, on: :member

    resources :manuals, module: :topics, only: [:new, :show, :create, :update] do
      post :regenerate, on: :member
      resources :videos, only: [:show, :create, :update] do
        get :status
      end
    end

    resources :comparison_sessions, module: :topics, only: [:index, :new, :create, :show, :destroy] do
      post :resolve, on: :member
      post :complete, on: :member
    end
  end
  resources :rooms, only: [:show]

  resources :users
  resources :user_groups, except: [:show] do
    member do
      get :members
      post :add_members
      delete :remove_member
    end
  end
  resources :data_sources, only: [:index]
  resources :glossary_terms, only: [:index]
  resources :scraper_admin, only: [:index]
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # ログイン
  get '/login', to: 'sessions#new'
  post '/login', to: 'sessions#create'
  delete '/logout', to: 'sessions#destroy'

  # メールアドレス確認
  get '/confirmation', to: 'confirmations#show', as: :confirmation
  get '/confirmation/new', to: 'confirmations#new', as: :new_confirmation
  post '/confirmation', to: 'confirmations#create'
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"

  # 開発環境限定: ユーザー切替
  if Rails.env.development?
    post '/dev/switch_user', to: 'dev/sessions#switch'
  end

  root "topics#index"
  resources :users

  # Messages API (メッセージのCRUD操作のみ)
  get '/api/messages', to: 'messages#index'
  post '/api/messages', to: 'messages#create'

  # Rooms API
  get '/api/rooms/list', to: 'rooms#list'
  get '/api/rooms/:id', to: 'rooms#show'
  post '/api/rooms', to: 'rooms#create'
  post '/api/rooms/find_or_create', to: 'rooms#find_or_create'

  # Chat Files API
  post '/api/chat_files/upload', to: 'chat_files#upload'
  get '/api/chat_files/download', to: 'chat_files#download'

  # Data Source API & Glossary Terms API
  namespace :api do
    resources :data_source_folders, only: [:index, :create, :update, :destroy] do
      member do
        patch :move
      end
    end
    resources :data_source_files, only: [:create, :update, :destroy] do
      member do
        get :download
        patch :move
        get :linked_topics
        post :retry_ai
      end
      collection do
        get :search
        post :bulk_create_topic
        post :retry_ai_all
      end
    end

    # Topic ↔ DataSource リンク管理
    resources :topics, only: [] do
      resources :data_source_links,
                controller: "topic_data_source_links",
                only: [:index, :create] do
        collection do
          delete :destroy
        end
      end
    end

    # 社内辞書
    resources :glossary_terms, only: [:index, :create, :update, :destroy] do
      collection do
        get :match
        post :import
      end
    end

    # DataAcquisition Jobs (Admin)
    resources :data_acquisition_jobs, only: [:index, :show, :create, :update, :destroy] do
      member do
        get :runs
        post :trigger
      end
    end
    resources :data_acquisition_records, only: [:index] do
      collection do
        get :csv
      end
    end

    # Scraper Admin Dashboard (privileged admin only)
    namespace :scraper_admin do
      get :overview
      get :jobs
      get :runs
      get :instances
      get :records
      get :record_summary
      get :company_summary
    end
  end

  # Comparison API (AI Server callback)
  post '/api/comparison_sessions/:id/results', to: 'api/comparison_results#create'

  # Requests API
  get '/api/requests/status', to: 'requests#status'
  post '/api/requests/:id/finish_hearing', to: 'requests#finish_hearing'
  get '/api/requests/:id/qa_csv', to: 'requests#qa_csv'
  get '/api/requests/:id/qa_data', to: 'requests#qa_data'
  get '/api/requests/:id/conflicts', to: 'requests#conflicts'
  post '/api/requests/:id/resolve_conflicts', to: 'requests#resolve_conflicts'
end
