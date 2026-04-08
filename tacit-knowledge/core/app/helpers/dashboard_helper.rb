module DashboardHelper
  def options_for_request_status
    Request.statuses.map do |key, value|
      [t("activerecord.attributes.request.statuses.#{key}"), value]
    end
  end

  def options_for_respondents
    User.all.map do |key, value|
      [key.name, key.id]
    end
  end

  def options_for_searching_fields
    {
      :request => {
        :status_eq => {
          label: t("activerecord.attributes.request.status"),
          options: options_for_request_status
        },
        :respondent_id_eq => {
          label: t("activerecord.attributes.request.respondent"),
          options: options_for_respondents
        },
      }, 
    }
  end

  def options_topics(requests)
    requests.flat_map(&:topic).map(&:name) || []
  end
end
