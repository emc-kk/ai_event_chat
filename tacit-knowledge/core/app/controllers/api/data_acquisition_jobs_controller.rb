module Api
  class DataAcquisitionJobsController < ApplicationController
    skip_before_action :verify_authenticity_token
    before_action :admin_required
    before_action :set_job, only: [:show, :update, :destroy, :runs, :trigger]

    # GET /api/data_acquisition_jobs
    def index
      jobs = if privileged_admin?
               DataAcquisitionJob.all
             else
               DataAcquisitionJob.for_company(current_company_id)
             end

      jobs = jobs.includes(:data_acquisition_job_runs).order(created_at: :desc)
      render json: { success: true, data: jobs.map { |j| job_json(j) } }
    end

    # GET /api/data_acquisition_jobs/:id
    def show
      render json: { success: true, data: job_json(@job) }
    end

    # POST /api/data_acquisition_jobs
    def create
      job = DataAcquisitionJob.new(job_params)
      job.id = ULID.generate

      if job.save
        render json: { success: true, data: job_json(job) }, status: :created
      else
        render json: { success: false, errors: job.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # PATCH /api/data_acquisition_jobs/:id
    def update
      if @job.update(job_params)
        render json: { success: true, data: job_json(@job) }
      else
        render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # DELETE /api/data_acquisition_jobs/:id
    def destroy
      @job.update!(status: 'paused')
      render json: { success: true }
    end

    # GET /api/data_acquisition_jobs/:id/runs
    def runs
      runs = @job.data_acquisition_job_runs.recent.limit(20)
      render json: {
        success: true,
        data: runs.map { |r| run_json(r) }
      }
    end

    # POST /api/data_acquisition_jobs/:id/trigger
    def trigger
      # SQSにジョブをdispatch (手動実行)
      run = DataAcquisitionJobRun.create!(
        id: ULID.generate,
        job_id: @job.id,
        status: 'running',
        started_at: Time.current,
        tasks_total: 0,
        tasks_completed: 0,
        tasks_failed: 0
      )

      render json: { success: true, data: run_json(run) }
    end

    private

    def set_job
      @job = DataAcquisitionJob.find(params[:id])
    end

    def job_params
      params.require(:data_acquisition_job).permit(:company_id, :name, :description, :status, job_definition: {})
    end

    def job_json(job)
      last_run = job.data_acquisition_job_runs.order(started_at: :desc).first
      record_count = DataAcquisitionRecord.where(job_id: job.id).count
      {
        id: job.id,
        company_id: job.company_id,
        name: job.name,
        description: job.description,
        job_definition: job.job_definition,
        status: job.status,
        record_count: record_count,
        last_run: last_run ? run_json(last_run) : nil,
        created_at: job.created_at,
        updated_at: job.updated_at
      }
    end

    def run_json(run)
      {
        id: run.id,
        job_id: run.job_id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        tasks_total: run.tasks_total,
        tasks_completed: run.tasks_completed,
        tasks_failed: run.tasks_failed
      }
    end
  end
end
