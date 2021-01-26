SHELL := /bin/bash
####################################################################################################
##
## Make for managing s3 Cache Action extension
##
####################################################################################################

install:
	npm install

init-local:
	npm run localstack:config
	npm run localstack:up

test:
	npm test
