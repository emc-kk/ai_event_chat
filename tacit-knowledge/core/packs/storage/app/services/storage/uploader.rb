module Storage
  class Uploader < CarrierWave::Uploader::Base
    storage :aws

    def initialize(model, extra_extensions = [])
      super(model)
      @extra_extensions = extra_extensions
    end

    def store_dir
      @custom_directory || default_store_dir
    end

    def set_directory(directory_path)
      @custom_directory = directory_path
    end

    def extension_allowlist
      %w(pdf doc docx xls xlsx ppt pptx txt csv) + @extra_extensions
    end

    private

    def default_store_dir
      timestamp = model.updated_at || Time.current
      "#{model.class.to_s.underscore}/#{model.id}/uploads/#{timestamp.to_i}"
    end

    def s3_path
      "#{store_dir}/#{filename}" if filename.present?
    end

    def upload_url
      url.presence || s3_path
    end
  end
end
