SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	poetry install
	make -C buildAndReleaseTask install

up:
	docker-compose up -d localstack

down:
	docker-compose down

test: up
	make -C buildAndReleaseTask test

test-watch: up
	make -C buildAndReleaseTask test-watch
