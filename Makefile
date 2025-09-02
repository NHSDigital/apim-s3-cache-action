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
	poetry run docker compose up -d localstack && \
	sleep 5 && \
	while true; do \
		status=$$(docker inspect -f '{{.State.Health.Status}}' apim-s3-cache-action-localstack-1); \
		if [ "$$status" = "healthy" ]; then break; fi; \
		echo "Waiting for localstack to become healthy... Current status: $$status"; \
		sleep 2; \
	done


down:
	poetry run docker compose down

test: up
	make -C s3CacheTask test

test-verbose: up
	make -C s3CacheTask test-verbose
