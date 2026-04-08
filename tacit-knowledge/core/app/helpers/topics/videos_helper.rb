module Topics::VideosHelper
  def substr(text, len = 30)
    if text.length > len
      text[0..len] + "..."
    else
      text
    end
  end

  def seconds_to_time(seconds)
    Time.at(seconds).strftime("%M:%S")
  end

  def thumbnail_url(key)
    return nil unless key.present?

    Storage::Api.signed_video_url(key)
  end
end
