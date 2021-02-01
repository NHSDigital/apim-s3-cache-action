#!/bin/bash
set -x
aws --endpoint-url=http://localhost:4566 s3 mb s3:/localstack-bucket --acl public-read
set +x