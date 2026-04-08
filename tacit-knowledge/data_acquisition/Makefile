.PHONY: build deploy deploy-staging validate logs-coordinator logs-receiver logs-writer

STACK_NAME ?= skillrelay-production-scraper

build:
	sam build

validate:
	sam validate --lint

deploy: build
	sam deploy

deploy-staging: build
	sam deploy --config-env staging

deploy-guided: build
	sam deploy --guided

logs-coordinator:
	sam logs -n CoordinatorFunction --stack-name $(STACK_NAME) --tail

logs-receiver:
	sam logs -n ReceiverFunction --stack-name $(STACK_NAME) --tail

logs-writer:
	sam logs -n WriterFunction --stack-name $(STACK_NAME) --tail

local-invoke-coordinator:
	sam local invoke CoordinatorFunction --event events/coordinator-event.json

package:
	sam package --output-template-file packaged.yaml --s3-bucket skillrelay-production-datasource --s3-prefix sam-artifacts
