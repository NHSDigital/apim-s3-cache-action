SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	npm install

build:
	docker-compose up -d localstack

test: build
	npm test

test-watch: build
	npm run test-watch
