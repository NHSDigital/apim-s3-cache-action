SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	poetry install
	make -C s3CacheTask install

up:
	docker-compose up -d localstack

down:
	docker-compose down

test: up
	make -C s3CacheTask test

test-watch: up
	make -C s3CacheTask test-watch
