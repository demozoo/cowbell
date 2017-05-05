#!/bin/bash

# Provisioning script for installing Emscripten

apt-get install -y build-essential cmake subversion pkg-config python-minimal

su - ubuntu -c "cd ~ && wget https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz && tar xzf emsdk-portable.tar.gz"
su - ubuntu -c "cd ~/emsdk-portable && ./emsdk update && ./emsdk install latest && ./emsdk activate latest"
su - ubuntu -c "echo 'source ~/emsdk-portable/emsdk_env.sh' >> ~/.bashrc"
