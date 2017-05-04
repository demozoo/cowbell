#!/bin/bash

# Provisioning script for installing Emscripten

apt-get install -y build-essential cmake subversion pkg-config

su - vagrant -c "cd ~ && wget https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz && tar xzf emsdk-portable.tar.gz"
su - vagrant -c "cd ~/emsdk-portable && ./emsdk update && ./emsdk install latest && ./emsdk activate latest"
su - vagrant -c "echo 'source ~/emsdk-portable/emsdk_env.sh' >> ~/.bashrc"
