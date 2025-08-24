# README

## ai_event_chat

This README would normally document whatever steps are necessary to get the
application up and running.

Things you may want to cover:

### Backend
- Ruby 3.3.0
- Ruby on Rails 7.1.x
- PostgreSQL 15+
- Inertia Rails (~> 3.10)

### Frontend
- Node.js 20.x LTS
- TypeScript 5.x
- React 19.x
- Vite 5.x
- Tailwind CSS 4.x
- Vite Ruby (~> 3.0)
- Emotion/react

### Development Tools
- Docker & Docker Compose
- Vite Plugin React
- PostCSS & Autoprefixer

* Configuration

* Database creation

* Database initialization

* How to run the test suite

* Services (job queues, cache servers, search engines, etc.)

* Deployment instructions

* ...

## setup

```
$ git clone git@github.com:emc-kk/ai_event_chat.git
$ cd ai_event_chat
$ docker componse build
$ docker compose up
```

## How This Project Was Built

```
$ rails new . --skip-js --skip-asset-pipeline
```

```
$ bundle add inertia_rails
```

```
$ bin/rails generate inertia:install
Installing Inertia's Rails adapter
Could not find a package.json file to install Inertia to.

Would you like to install Vite Ruby? (y/n) y
         run  bundle add vite_rails from "."
Vite Rails gem successfully installed
         run  bundle exec vite install from "."
Vite Rails successfully installed

Would you like to install Tailwind CSS? (y/n) y
Installing Tailwind CSS
         run  npm add tailwindcss postcss autoprefixer @tailwindcss/forms @tailwindcss/typography @tailwindcss/container-queries --silent from "."
      create  tailwind.config.js
      create  postcss.config.js
      create  app/frontend/entrypoints/application.css
Adding Tailwind CSS to the application layout
      insert  app/views/layouts/application.html.erb
Adding Inertia's Rails adapter initializer
      create  config/initializers/inertia_rails.rb
Installing Inertia npm packages

What framework do you want to use with Inertia? [react, vue, svelte] (react)
         run  npm add @inertiajs/react react react-dom @vitejs/plugin-react --silent from "."
Adding Vite plugin for react
      insert  vite.config.ts
     prepend  vite.config.ts
Copying inertia.js entrypoint
      create  app/frontend/entrypoints/inertia.js
Adding inertia.js script tag to the application layout
      insert  app/views/layouts/application.html.erb
Adding Vite React Refresh tag to the application layout
      insert  app/views/layouts/application.html.erb
        gsub  app/views/layouts/application.html.erb
Copying example Inertia controller
      create  app/controllers/inertia_example_controller.rb
Adding a route for the example Inertia controller
       route  get 'inertia-example', to: 'inertia_example#index'
Copying page assets
      create  app/frontend/pages/InertiaExample.jsx
      create  app/frontend/pages/InertiaExample.module.css
      create  app/frontend/assets/react.svg
      create  app/frontend/assets/inertia.svg
      create  app/frontend/assets/vite_ruby.svg
Copying bin/dev
      create  bin/dev
Inertia's Rails adapter successfully installed
```
