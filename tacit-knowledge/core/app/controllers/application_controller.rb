class ApplicationController < ActionController::Base
  include SessionsHelper
  before_action :login_check
end
