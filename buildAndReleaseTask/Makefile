SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	npm install

up:
	docker-compose up -d localstack

down:
	docker-compose down

test: up
	npm test

test-watch: up
	npm run test-watch
