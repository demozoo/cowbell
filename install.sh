#!/bin/bash

apt-get update
apt-get install -y pasmo

# install Node.js + coffeescript
# as per instructions on https://github.com/nodesource/distributions
curl -sL https://deb.nodesource.com/setup_4.x | bash -
apt-get install -y nodejs
npm install -g coffee-script

apt-get install -y closure-compiler
