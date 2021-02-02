SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	make -C s3CacheTask install
	poetry install

up:
	docker-compose up -d localstack

down:
	docker-compose down

test: up
	make -C s3CacheTask test
