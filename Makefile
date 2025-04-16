SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	make -C s3CacheTask install
	poetry install

install-node:
	make -C s3CacheTask install

install-poetry:
	poetry install

up:
	poetry run docker compose up -d localstack && poetry run docker compose wait --wait

down:
	poetry run docker compose down

test: up
	make -C s3CacheTask test

test-verbose: up
	make -C s3CacheTask test-verbose
