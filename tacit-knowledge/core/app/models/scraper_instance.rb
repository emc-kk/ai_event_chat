class ScraperInstance < ApplicationRecord
  self.table_name = "scraper_instances"

  scope :active, -> { where.not(status: 'removed') }
  scope :online, -> { where(status: 'online') }
  scope :by_status, ->(status) { where(status: status) }
end
