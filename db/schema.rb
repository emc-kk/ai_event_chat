# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2025_09_24_000000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "contact_submissions", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.string "company_name", null: false
    t.string "email", null: false
    t.json "interested_services", null: false, comment: "Array of service names user is interested in"
    t.json "service_ids", null: false, comment: "Array of service IDs corresponding to interested services"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["company_name"], name: "index_contact_submissions_on_company_name"
    t.index ["created_at"], name: "index_contact_submissions_on_created_at"
    t.index ["email"], name: "index_contact_submissions_on_email"
  end

  create_table "quiz_results", id: { type: :string, limit: 26 }, force: :cascade do |t|
    t.integer "quiz", null: false
    t.bigint "completion_time", null: false
    t.integer "correct_count", null: false
    t.json "answers", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "score"
    t.index ["completion_time"], name: "index_quiz_results_on_completion_time"
    t.index ["correct_count"], name: "index_quiz_results_on_correct_count"
    t.index ["quiz"], name: "index_quiz_results_on_quiz"
    t.index ["score"], name: "index_quiz_results_on_score"
  end

end
