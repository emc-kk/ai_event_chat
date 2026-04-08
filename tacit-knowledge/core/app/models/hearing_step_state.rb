class HearingStepState < ApplicationRecord
  belongs_to :request

  STEP_NAMES = {
    0 => 'Hard NG排除',
    1 => '前提確認',
    2 => '定量・定性評価'
  }.freeze

  validates :current_step, inclusion: { in: [0, 1, 2] }
  validates :current_step_status, inclusion: { in: %w[active completed] }

  def step_name
    STEP_NAMES[current_step] || "Step #{current_step}"
  end

  def active?
    current_step_status == 'active'
  end

  def completed?
    current_step_status == 'completed'
  end
end
