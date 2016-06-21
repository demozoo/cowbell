#!/bin/bash

# Provisioning script for installing Emscripten

apt-get install -y build-essential cmake

su - vagrant -c "cd ~ && wget https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz && tar xzf emsdk-portable.tar.gz"
su - vagrant -c "cd ~/emsdk_portable && ./emsdk update && ./emsdk install latest && ./emsdk activate latest"
su - vagrant -c "echo 'source ~/emsdk_portable/emsdk_env.sh' >> ~/.bashrc"
