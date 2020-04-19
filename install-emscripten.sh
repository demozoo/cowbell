#!/bin/bash

# Provisioning script for installing Emscripten

apt-get install -y build-essential cmake subversion pkg-config python-minimal make python3-distutils

su - vagrant -c "cd ~ && git clone https://github.com/emscripten-core/emsdk.git"
su - vagrant -c "cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest"
su - vagrant -c "echo 'source ~/emsdk/emsdk_env.sh' >> ~/.bashrc"
