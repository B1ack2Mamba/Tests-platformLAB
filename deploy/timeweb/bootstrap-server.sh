#!/usr/bin/env bash
# Run only on the newly provisioned kadrlab-ru server, before restoring data.
# Docker installation follows https://docs.docker.com/engine/install/ubuntu/.
set -Eeuo pipefail
umask 027

[[ ${EUID} -eq 0 ]] || { echo 'Run as root on the new server.' >&2; exit 1; }
[[ $(hostname -s) == kadrlab-ru ]] || { echo 'Unexpected target host.' >&2; exit 1; }
. /etc/os-release
[[ ${ID} == ubuntu && ${VERSION_ID} == 24.04 ]] || { echo 'Ubuntu 24.04 is required.' >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git jq openssl ufw

if ! command -v docker >/dev/null 2>&1; then
  # Do not remove or replace a pre-existing container runtime automatically.
  for package in docker.io docker-compose docker-compose-v2 podman-docker containerd runc; do
    if dpkg-query -W -f='${Status}' "$package" 2>/dev/null | grep -q 'install ok installed'; then
      echo "Review existing package before installing Docker CE: $package" >&2
      exit 1
    fi
  done
  install -m 0755 -d /etc/apt/keyrings
  curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod 0644 /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/kadrlab-docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
compose_version=$(docker compose version --short | sed 's/^v//')
dpkg --compare-versions "$compose_version" ge 2.24.4 || { echo 'Docker Compose >= 2.24.4 is required.' >&2; exit 1; }

# A small swap reserve prevents a transient build peak from killing the database.
# It does not replace measuring the steady-state memory and response times.
if [[ ! -e /swapfile-kadrlab ]]; then
  available_kb=$(df --output=avail / | tail -n 1 | tr -d ' ')
  [[ $available_kb -ge 12582912 ]] || { echo 'Not enough free disk for swap and containers.' >&2; exit 1; }
  fallocate -l 4G /swapfile-kadrlab
  chmod 0600 /swapfile-kadrlab
  mkswap /swapfile-kadrlab
fi
if ! swapon --show=NAME --noheadings | grep -Fxq /swapfile-kadrlab; then
  swapon /swapfile-kadrlab
fi
if ! grep -Eq '^/swapfile-kadrlab[[:space:]]' /etc/fstab; then
  printf '\n/swapfile-kadrlab none swap sw 0 0\n' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/90-kadrlab-swap.conf
sysctl -p /etc/sysctl.d/90-kadrlab-swap.conf

install -d -m 0750 /opt/kadrlab /opt/kadrlab/app /opt/kadrlab/supabase-runtime
install -d -m 0700 /opt/kadrlab/backups /opt/kadrlab/secrets

# Keep SSH available before enabling the firewall. Container database/admin
# ports must additionally bind to loopback in the Compose override.
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

docker version --format 'Docker server: {{.Server.Version}}'
docker compose version
free -h
df -h /
ufw status
