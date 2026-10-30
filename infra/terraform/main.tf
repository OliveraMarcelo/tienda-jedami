terraform {
  required_version = ">= 1.6"

  required_providers {
    libvirt = {
      source  = "dmacvicar/libvirt"
      version = "~> 0.8.0"
    }
  }
}

provider "libvirt" {
  uri = "qemu:///system"
}

# ─── Red dedicada para jedami ────────────────────────────────────────────────

resource "libvirt_network" "jedami" {
  name      = "jedami-net"
  mode      = "nat"
  domain    = "jedami.local"
  addresses = ["192.168.100.0/24"]
  autostart = true

  dns {
    enabled    = true
    local_only = false
  }
}

# ─── Imagen base Ubuntu 22.04 (descargada una sola vez) ──────────────────────

resource "libvirt_volume" "ubuntu_base" {
  name   = "ubuntu-22.04-base.qcow2"
  pool   = "default"
  source = var.ubuntu_image_url
  format = "qcow2"
}

# ─── Volúmenes de disco por VM (clones del base) ─────────────────────────────

resource "libvirt_volume" "dev_disk" {
  name           = "jedami-dev.qcow2"
  pool           = "default"
  base_volume_id = libvirt_volume.ubuntu_base.id
  size           = var.disk_size_bytes
  format         = "qcow2"
}

resource "libvirt_volume" "stg_disk" {
  name           = "jedami-stg.qcow2"
  pool           = "default"
  base_volume_id = libvirt_volume.ubuntu_base.id
  size           = var.disk_size_bytes
  format         = "qcow2"
}

# ─── Cloud-init por VM ───────────────────────────────────────────────────────

resource "libvirt_cloudinit_disk" "dev_init" {
  name      = "jedami-dev-cloudinit.iso"
  pool      = "default"
  user_data = templatefile("${path.module}/cloud-init.yaml.tpl", {
    hostname   = "jedami-dev"
    ssh_pubkey = file(var.ssh_public_key_path)
  })
}

resource "libvirt_cloudinit_disk" "stg_init" {
  name      = "jedami-stg-cloudinit.iso"
  pool      = "default"
  user_data = templatefile("${path.module}/cloud-init.yaml.tpl", {
    hostname   = "jedami-stg"
    ssh_pubkey = file(var.ssh_public_key_path)
  })
}

# ─── VM dev ──────────────────────────────────────────────────────────────────

resource "libvirt_domain" "dev" {
  name   = "jedami-dev"
  memory = var.dev_ram_mb
  vcpu   = var.dev_vcpu

  cloudinit = libvirt_cloudinit_disk.dev_init.id

  network_interface {
    network_id     = libvirt_network.jedami.id
    hostname       = "jedami-dev"
    addresses      = ["192.168.100.10"]
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.dev_disk.id
  }

  console {
    type        = "pty"
    target_port = "0"
    target_type = "serial"
  }

  graphics {
    type        = "vnc"
    listen_type = "address"
    autoport    = true
  }
}

# ─── VM stg ──────────────────────────────────────────────────────────────────

resource "libvirt_domain" "stg" {
  name   = "jedami-stg"
  memory = var.stg_ram_mb
  vcpu   = var.stg_vcpu

  cloudinit = libvirt_cloudinit_disk.stg_init.id

  network_interface {
    network_id     = libvirt_network.jedami.id
    hostname       = "jedami-stg"
    addresses      = ["192.168.100.11"]
    wait_for_lease = true
  }

  disk {
    volume_id = libvirt_volume.stg_disk.id
  }

  console {
    type        = "pty"
    target_port = "0"
    target_type = "serial"
  }

  graphics {
    type        = "vnc"
    listen_type = "address"
    autoport    = true
  }
}
