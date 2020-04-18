#!/bin/bash

# Provisioning script for installing the build dependencies under Vagrant + Ubuntu

apt-get update
apt-get install -y pasmo make

# install Node.js + coffeescript
# as per instructions on https://github.com/nodesource/distributions
curl -sL https://deb.nodesource.com/setup_10.x | bash -
apt-get install -y nodejs
npm install -g coffeescript@1.12.7

apt-get install -y closure-compiler
