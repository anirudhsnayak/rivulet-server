#!/bin/bash

# Load environment variables from .env file
set -o allexport
source .env
set +o allexport

# Run PostgreSQL container
docker run -d \
  --name rivulet-postgres \
  -e POSTGRES_USER=$POSTGRES_USER \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$POSTGRES_DB \
  -p $POSTGRES_PORT:5432 \
  -v rivulet-data:/var/lib/postgresql \
  postgres:latest