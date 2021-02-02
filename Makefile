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
	poetry run docker-compose-wait up -d localstack

down:
	poetry run docker-compose down

test: up
	make -C s3CacheTask test
