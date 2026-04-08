require 'csv'

module Api
  class DataAcquisitionRecordsController < ApplicationController
    skip_before_action :verify_authenticity_token
    before_action :admin_required

    # GET /api/data_acquisition_records
    def index
      records = scoped_records
      records = records.where(job_id: params[:job_id]) if params[:job_id].present?
      records = records.by_type(params[:record_type]) if params[:record_type].present?
      records = records.where('fetched_at >= ?', params[:fetched_after]) if params[:fetched_after].present?
      records = records.where('fetched_at <= ?', params[:fetched_before]) if params[:fetched_before].present?
      records = records.recent.limit(params.fetch(:limit, 50).to_i)

      render json: {
        success: true,
        data: records.map { |r| record_json(r) }
      }
    end

    # GET /api/data_acquisition_records/csv?job_id=xxx&fetched_after=...&fetched_before=...
    def csv
      records = scoped_records
      records = records.where(job_id: params[:job_id]) if params[:job_id].present?
      records = records.where('fetched_at >= ?', params[:fetched_after]) if params[:fetched_after].present?
      records = records.where('fetched_at <= ?', params[:fetched_before]) if params[:fetched_before].present?
      records = records.recent.limit(10_000)

      job = DataAcquisitionJob.find_by(id: params[:job_id])
      filename = "#{job&.name || 'data'}_#{Date.today.iso8601}.csv"

      csv_data = generate_csv(records)
      bom = "\xEF\xBB\xBF"

      send_data bom + csv_data,
        filename: filename,
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment'
    end

    private

    def scoped_records
      if privileged_admin?
        DataAcquisitionRecord.all
      else
        DataAcquisitionRecord.for_company(current_company_id)
      end
    end

    def generate_csv(records)
      loaded = records.to_a
      return "" if loaded.empty?

      headers = loaded.first.data.keys
      CSV.generate do |csv|
        csv << headers
        loaded.each do |record|
          csv << headers.map { |h| record.data[h] }
        end
      end
    end

    def record_json(record)
      {
        id: record.id,
        company_id: record.company_id,
        job_id: record.job_id,
        record_type: record.record_type,
        data: record.data,
        source_url: record.source_url,
        fetched_at: record.fetched_at,
        created_at: record.created_at
      }
    end
  end
end
