#!/usr/bin/env bash

# exit on first failing command
set -o errexit
set -o verbose

grunt validate-shrinkwrap
grunt lint
npm run test-server
travis_retry npm run test-travis
