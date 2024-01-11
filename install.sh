#!/bin/bash

# Provisioning script for installing the build dependencies under Vagrant + Ubuntu

apt-get update
apt-get install -y pasmo make

# install Node.js + coffeescript
# as per instructions on https://github.com/nodesource/distributions
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g coffeescript@1.12.7
npm install -g babel-minify@0.5.2
