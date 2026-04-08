module Api
  class ScraperAdminController < ApplicationController
    skip_before_action :verify_authenticity_token
    before_action :privileged_admin_required

    # GET /api/scraper_admin/overview
    def overview
      now = Time.current

      jobs_by_status = DataAcquisitionJob.group(:status).count
      runs_24h = DataAcquisitionJobRun.where("started_at >= ?", now - 24.hours)
      runs_7d = DataAcquisitionJobRun.where("started_at >= ?", now - 7.days)
      records_today = DataAcquisitionRecord.where("created_at >= ?", now.beginning_of_day).count

      completed_24h = runs_24h.where(status: 'completed').count
      failed_24h = runs_24h.where(status: 'failed').count
      total_24h = runs_24h.count
      success_rate_24h = total_24h > 0 ? (completed_24h.to_f / total_24h * 100).round(1) : nil

      # 直近7日の日別成功率
      daily_stats = runs_7d
        .group("DATE(started_at)")
        .select("DATE(started_at) as date, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed")
        .map { |r| { date: r.date, total: r.total, completed: r.completed } }

      # 最新のrun 10件
      recent_runs = DataAcquisitionJobRun
        .joins("INNER JOIN data_acquisition_jobs ON data_acquisition_jobs.id = data_acquisition_job_runs.job_id")
        .joins("INNER JOIN companies ON companies.id = data_acquisition_jobs.company_id")
        .select(
          "data_acquisition_job_runs.*",
          "data_acquisition_jobs.name as job_name",
          "companies.name as company_name"
        )
        .order(started_at: :desc)
        .limit(10)

      render json: {
        success: true,
        data: {
          jobs_total: DataAcquisitionJob.count,
          jobs_by_status: jobs_by_status,
          runs_24h: total_24h,
          runs_7d: runs_7d.count,
          success_rate_24h: success_rate_24h,
          completed_24h: completed_24h,
          failed_24h: failed_24h,
          records_today: records_today,
          daily_stats: daily_stats,
          recent_runs: recent_runs.map { |r| recent_run_json(r) }
        }
      }
    end

    # GET /api/scraper_admin/jobs
    def jobs
      page = (params[:page] || 1).to_i
      per = (params[:per] || 20).to_i

      scope = DataAcquisitionJob.joins(:company)
      scope = scope.where(status: params[:status]) if params[:status].present?
      scope = scope.where(company_id: params[:company_id]) if params[:company_id].present?

      total = scope.count
      jobs = scope
        .includes(:data_acquisition_job_runs)
        .select("data_acquisition_jobs.*, companies.name as company_name")
        .order(created_at: :desc)
        .offset((page - 1) * per).limit(per)

      render json: {
        success: true,
        data: jobs.map { |j| admin_job_json(j) },
        meta: { page: page, per: per, total: total }
      }
    end

    # GET /api/scraper_admin/runs
    def runs
      page = (params[:page] || 1).to_i
      per = (params[:per] || 30).to_i
      days = (params[:days] || 7).to_i

      scope = DataAcquisitionJobRun
        .joins("INNER JOIN data_acquisition_jobs ON data_acquisition_jobs.id = data_acquisition_job_runs.job_id")
        .joins("INNER JOIN companies ON companies.id = data_acquisition_jobs.company_id")
        .where("data_acquisition_job_runs.started_at >= ?", Time.current - days.days)

      scope = scope.where("data_acquisition_jobs.company_id = ?", params[:company_id]) if params[:company_id].present?
      scope = scope.where("data_acquisition_job_runs.status = ?", params[:status]) if params[:status].present?

      total = scope.count
      runs = scope
        .select(
          "data_acquisition_job_runs.*",
          "data_acquisition_jobs.name as job_name",
          "companies.name as company_name"
        )
        .order(started_at: :desc)
        .offset((page - 1) * per).limit(per)

      render json: {
        success: true,
        data: runs.map { |r| recent_run_json(r) },
        meta: { page: page, per: per, total: total }
      }
    end

    # GET /api/scraper_admin/instances
    def instances
      instances = ScraperInstance.active.order(:name)

      render json: {
        success: true,
        data: instances.map { |i| instance_json(i) }
      }
    end

    # GET /api/scraper_admin/record_summary
    def record_summary
      scope = DataAcquisitionRecord
        .joins("INNER JOIN data_acquisition_jobs ON data_acquisition_jobs.id = data_acquisition_records.job_id")
        .joins("INNER JOIN companies ON companies.id = data_acquisition_records.company_id")

      scope = scope.where(company_id: params[:company_id]) if params[:company_id].present?

      summaries = scope
        .group("data_acquisition_records.job_id", "data_acquisition_jobs.name", "companies.name")
        .select(
          "data_acquisition_records.job_id",
          "data_acquisition_jobs.name as job_name",
          "companies.name as company_name",
          "COUNT(*) as record_count",
          "MAX(data_acquisition_records.fetched_at) as latest_fetched_at"
        )
        .order("MAX(data_acquisition_records.fetched_at) DESC")

      render json: {
        success: true,
        data: summaries.map { |s|
          {
            job_id: s.job_id,
            job_name: s.job_name,
            company_name: s.company_name,
            record_count: s.record_count,
            latest_fetched_at: s.latest_fetched_at
          }
        }
      }
    end

    # GET /api/scraper_admin/company_summary
    def company_summary
      companies_data = Company
        .joins(:data_acquisition_jobs)
        .distinct
        .select("companies.id, companies.name")
        .order("companies.name")

      result = companies_data.map do |company|
        jobs = DataAcquisitionJob.where(company_id: company.id)
        jobs_total = jobs.count
        jobs_active = jobs.where(status: 'active').count

        latest_run = DataAcquisitionJobRun
          .joins("INNER JOIN data_acquisition_jobs ON data_acquisition_jobs.id = data_acquisition_job_runs.job_id")
          .where("data_acquisition_jobs.company_id = ?", company.id)
          .order(started_at: :desc)
          .first

        record_count = DataAcquisitionRecord.where(company_id: company.id).count

        {
          company_id: company.id,
          company_name: company.name,
          jobs_total: jobs_total,
          jobs_active: jobs_active,
          latest_run_status: latest_run&.status,
          record_count: record_count
        }
      end

      render json: {
        success: true,
        data: result
      }
    end

    # GET /api/scraper_admin/records
    def records
      page = (params[:page] || 1).to_i
      per = (params[:per] || 30).to_i

      scope = DataAcquisitionRecord
        .joins("INNER JOIN data_acquisition_jobs ON data_acquisition_jobs.id = data_acquisition_records.job_id")
        .joins("INNER JOIN companies ON companies.id = data_acquisition_records.company_id")

      scope = scope.where(company_id: params[:company_id]) if params[:company_id].present?
      scope = scope.where(job_id: params[:job_id]) if params[:job_id].present?
      scope = scope.where(record_type: params[:record_type]) if params[:record_type].present?

      total = scope.count
      records = scope
        .select(
          "data_acquisition_records.*",
          "data_acquisition_jobs.name as job_name",
          "companies.name as company_name"
        )
        .order(created_at: :desc)
        .offset((page - 1) * per).limit(per)

      render json: {
        success: true,
        data: records.map { |r| record_json(r) },
        meta: { page: page, per: per, total: total }
      }
    end

    private

    def admin_job_json(job)
      last_run = job.data_acquisition_job_runs.order(started_at: :desc).first
      cron_expr = job.job_definition&.dig("schedule", "cron")
      {
        id: job.id,
        company_id: job.company_id,
        company_name: job.respond_to?(:company_name) ? job.company_name : nil,
        name: job.name,
        description: job.description,
        job_definition: job.job_definition,
        status: job.status,
        dispatch_target: job.dispatch_target,
        cron: cron_expr,
        last_run: last_run ? {
          id: last_run.id,
          status: last_run.status,
          started_at: last_run.started_at,
          completed_at: last_run.completed_at,
          tasks_total: last_run.tasks_total,
          tasks_completed: last_run.tasks_completed,
          tasks_failed: last_run.tasks_failed
        } : nil,
        created_at: job.created_at,
        updated_at: job.updated_at
      }
    end

    def recent_run_json(run)
      {
        id: run.id,
        job_id: run.job_id,
        job_name: run.respond_to?(:job_name) ? run.job_name : nil,
        company_name: run.respond_to?(:company_name) ? run.company_name : nil,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        tasks_total: run.tasks_total,
        tasks_completed: run.tasks_completed,
        tasks_failed: run.tasks_failed
      }
    end

    def instance_json(instance)
      {
        id: instance.id,
        name: instance.name,
        host: instance.host,
        port: instance.port,
        status: instance.status,
        max_concurrency: instance.max_concurrency,
        current_tasks: instance.current_tasks,
        capabilities: instance.capabilities,
        resource_thresholds: instance.resource_thresholds,
        tags: instance.tags,
        last_health_check_at: instance.last_checked_at,
        updated_at: instance.updated_at
      }
    end

    def record_json(record)
      {
        id: record.id,
        company_id: record.company_id,
        company_name: record.respond_to?(:company_name) ? record.company_name : nil,
        job_id: record.job_id,
        job_name: record.respond_to?(:job_name) ? record.job_name : nil,
        run_id: record.run_id,
        record_type: record.record_type,
        source_url: record.source_url,
        fetched_at: record.fetched_at,
        created_at: record.created_at
      }
    end
  end
end
