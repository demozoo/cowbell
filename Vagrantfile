# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "ubuntu/jammy64"

  config.vm.provision :shell, :path => "install.sh"

  config.vm.provider "virtualbox" do |vb|
    # Keep time in sync with host machine (avoids Makefile weirdness)
    vb.customize ["guestproperty", "set", :id, "/VirtualBox/GuestAdd/VBoxService/--timesync-set-threshold", 10000]
  end

  # Default config: a lightweight box that doesn't include the emscripten compiler.
  # It's recommended to use this, unless you plan to rebuild libopenmpt.
  # To build and use this box:
  #   vagrant up
  #   vagrant ssh

  config.vm.define "basic", primary: true do |basic|
    basic.vm.provider "virtualbox" do |vb|
      # Customize the amount of memory on the VM:
      vb.memory = "1024"
    end
  end


  # Big resource-hog VM image including the emscripten compiler.
  # Requires 4Gb of memory, and takes about an hour to build.
  # To build and use this box:
  #   vagrant up emscripten
  #   vagrant ssh emscripten

  config.vm.define "emscripten", autostart: false do |em|
    em.vm.provider "virtualbox" do |vb|
      # Customize the amount of memory on the VM:
      vb.memory = "4096"
    end

    em.vm.provision :shell, :path => "install-emscripten.sh"
  end
end
