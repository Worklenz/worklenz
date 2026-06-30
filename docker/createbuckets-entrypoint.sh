#!/bin/sh
set -e

echo "Waiting for MinIO to start..."
sleep 15

for i in 1 2 3 4 5; do
  echo "Attempt $i to connect to MinIO..."
  if /usr/bin/mc alias set myminio http://minio:9000 minioadmin minioadmin; then
    echo "Successfully connected to MinIO!"
    /usr/bin/mc mb --ignore-existing myminio/worklenz-bucket
    /usr/bin/mc policy set public myminio/worklenz-bucket
    exit 0
  fi

  echo "Connection failed, retrying in 5 seconds..."
  sleep 5
done

echo "Failed to connect to MinIO after 5 attempts"
exit 1

