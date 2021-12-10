#!/bin/bash

# Entrypoint in Development

AWS_SECRET_ID="arn:aws:secretsmanager:us-east-2:399151443846:secret:DOT_ENV-Na4otL"
AWS_REGION="us-east-2"
ENVFILE=".env"
aws secretsmanager get-secret-value --secret-id $AWS_SECRET_ID --region $AWS_REGION | \
  jq -r '.SecretString' | \
  jq -r "to_entries|map(\"\(.key)=\\\"\(.value|tostring)\\\"\")|.[]" > $ENVFILE
concurrently "NODE_PATH=dist/ pm2 start dist/server.js --name eupheme-api -i max" "nginx -c /etc/nginx/nginx.conf -g 'daemon off;'" "pm2 log"