#!/usr/bin/env pwsh

Write-Host "Building server..."
npm run build:server

Write-Host "Starting server on port 8080..."
node dist/server/index.js
