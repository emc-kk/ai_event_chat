#!/bin/bash
# =============================================================================
# SkillRelay Scraper Agent — Universal Setup Script
# =============================================================================
#
# 任意のEC2インスタンスをスクレイピング対応にする汎用セットアップスクリプト。
# OS差異 (Amazon Linux 2/2023, Ubuntu, Debian, CentOS) を自動検出して吸収する。
#
# Usage:
#   scp setup.sh user@target-ec2:~/ && ssh user@target-ec2 "bash setup.sh"
#   ssh user@target-ec2 "curl -sSL https://s3-url/setup.sh | bash"
#
# Options:
#   --no-docker     Docker のインストールをスキップ
#   --no-chrome     Chrome のインストールをスキップ
#   --s3-package    S3からスクレイパーコードをダウンロード (URL指定)
#
# =============================================================================

set -euo pipefail

INSTALL_DIR="/opt/scraper-agent"
LOG_FILE="/var/log/scraper-agent-setup.log"
INSTALL_DOCKER=true
INSTALL_CHROME=true
S3_PACKAGE=""
ECR_IMAGE=""
AWS_REGION="ap-northeast-1"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-docker)  INSTALL_DOCKER=false; shift ;;
        --no-chrome)  INSTALL_CHROME=false; shift ;;
        --s3-package) S3_PACKAGE="$2"; shift 2 ;;
        --ecr-image)  ECR_IMAGE="$2"; shift 2 ;;
        --region)     AWS_REGION="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log_ok()   { log "[OK]      $1"; }
log_skip() { log "[SKIP]    $1"; }
log_install() { log "[INSTALL] $1"; }
log_error()   { log "[ERROR]   $1"; }

# ---------------------------------------------------------------------------
# OS / Package Manager Detection
# ---------------------------------------------------------------------------
PKG_MGR=""
OS_NAME=""
OS_VERSION=""

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS_NAME="$ID"
        OS_VERSION="${VERSION_ID:-unknown}"
    elif [ -f /etc/system-release ]; then
        OS_NAME="amzn"
        OS_VERSION="2"
    else
        OS_NAME="unknown"
        OS_VERSION="unknown"
    fi
    log "OS detected: $OS_NAME $OS_VERSION"
}

detect_pkg_manager() {
    if command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
    elif command -v yum &>/dev/null; then
        PKG_MGR="yum"
    elif command -v apt-get &>/dev/null; then
        PKG_MGR="apt"
    else
        log_error "Unsupported package manager. Supported: dnf, yum, apt-get"
        exit 1
    fi
    log "Package manager: $PKG_MGR"
}

# ---------------------------------------------------------------------------
# Package install helper
# ---------------------------------------------------------------------------
pkg_install() {
    case "$PKG_MGR" in
        dnf) sudo dnf install -y "$@" 2>&1 | tail -1 ;;
        yum) sudo yum install -y "$@" 2>&1 | tail -1 ;;
        apt) sudo apt-get install -y "$@" 2>&1 | tail -1 ;;
    esac
}

pkg_update() {
    case "$PKG_MGR" in
        dnf) sudo dnf check-update -y 2>/dev/null || true ;;
        yum) sudo yum check-update -y 2>/dev/null || true ;;
        apt) sudo apt-get update -y 2>&1 | tail -1 ;;
    esac
}

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------
install_docker() {
    if [ "$INSTALL_DOCKER" = false ]; then
        log_skip "Docker (--no-docker specified)"
        return
    fi

    if command -v docker &>/dev/null; then
        log_ok "Docker already installed: $(docker --version 2>/dev/null || echo 'version unknown')"
        # Ensure Docker is running
        if ! sudo systemctl is-active --quiet docker 2>/dev/null; then
            sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null || true
        fi
        return
    fi

    log_install "Docker..."
    case "$PKG_MGR" in
        dnf)
            sudo dnf install -y docker 2>&1 | tail -1
            ;;
        yum)
            # Amazon Linux 2
            sudo amazon-linux-extras install docker -y 2>/dev/null \
                || sudo yum install -y docker 2>&1 | tail -1
            ;;
        apt)
            sudo apt-get install -y docker.io 2>&1 | tail -1
            ;;
    esac

    # Start and enable
    if command -v systemctl &>/dev/null; then
        sudo systemctl start docker 2>/dev/null || true
        sudo systemctl enable docker 2>/dev/null || true
    else
        sudo service docker start 2>/dev/null || true
        sudo chkconfig docker on 2>/dev/null || true
    fi

    # Add current user to docker group
    sudo usermod -aG docker "$(whoami)" 2>/dev/null || true

    if command -v docker &>/dev/null; then
        log_ok "Docker installed: $(docker --version 2>/dev/null)"
    else
        log_error "Docker installation failed (non-fatal, Python mode available)"
    fi
}

# ---------------------------------------------------------------------------
# Python 3.11+
# ---------------------------------------------------------------------------
PYTHON_CMD=""

install_python() {
    # Check existing Python versions
    # 1. AMI にプリインストールされた Python (INSTALL_DIR 内)
    if [ -x "$INSTALL_DIR/python3/bin/python3.11" ]; then
        PYTHON_CMD="$INSTALL_DIR/python3/bin/python3.11"
        log_ok "Python already installed (AMI): $($PYTHON_CMD --version 2>&1)"
        return
    fi

    # 2. システム PATH 上の Python
    for cmd in python3.11 python3.12 python3; do
        if command -v "$cmd" &>/dev/null; then
            local ver
            ver=$("$cmd" --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
            local major minor
            major=$(echo "$ver" | cut -d. -f1)
            minor=$(echo "$ver" | cut -d. -f2)
            if [ "$major" -ge 3 ] && [ "$minor" -ge 11 ]; then
                PYTHON_CMD="$cmd"
                log_ok "Python already installed: $($cmd --version 2>&1)"
                return
            fi
        fi
    done

    log_install "Python 3.11..."
    case "$PKG_MGR" in
        dnf)
            sudo dnf install -y python3.11 python3.11-pip 2>&1 | tail -1
            PYTHON_CMD="python3.11"
            ;;
        yum)
            # Amazon Linux 2: try amazon-linux-extras first
            # Amazon Linux 2018.03 (GLIBC 2.17): compile from source
            sudo amazon-linux-extras install python3.8 -y 2>/dev/null || true

            if command -v python3.11 &>/dev/null; then
                PYTHON_CMD="python3.11"
            elif command -v python3.8 &>/dev/null; then
                PYTHON_CMD="python3.8"
            elif command -v python3 &>/dev/null; then
                local existing_ver
                existing_ver=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
                local ex_major ex_minor
                ex_major=$(echo "$existing_ver" | cut -d. -f1)
                ex_minor=$(echo "$existing_ver" | cut -d. -f2)
                if [ "$ex_major" -ge 3 ] && [ "$ex_minor" -ge 8 ]; then
                    PYTHON_CMD="python3"
                fi
            fi

            # Fallback: compile Python 3.11 from source (for old AMIs like AL 2018.03)
            if [ -z "$PYTHON_CMD" ]; then
                log_install "Python 3.11 from source (old OS detected)..."
                sudo yum install -y gcc openssl-devel bzip2-devel libffi-devel \
                    zlib-devel readline-devel sqlite-devel wget make perl-core 2>&1 | tail -1

                # Python 3.11 requires OpenSSL 1.1.1+; old AMIs may have 1.0.2
                local sys_openssl_ver
                sys_openssl_ver=$(openssl version 2>/dev/null | grep -oP '\d+\.\d+' | head -1 || echo "0.0")
                local openssl_minor
                openssl_minor=$(echo "$sys_openssl_ver" | cut -d. -f2)

                OPENSSL_PREFIX=""
                if [ "${openssl_minor:-0}" -lt 1 ] 2>/dev/null; then
                    log_install "OpenSSL 1.1.1 from source (system has $(openssl version 2>/dev/null))..."
                    cd /tmp
                    wget -q https://www.openssl.org/source/openssl-1.1.1w.tar.gz
                    tar xzf openssl-1.1.1w.tar.gz
                    cd openssl-1.1.1w
                    ./config --prefix="$INSTALL_DIR/openssl" --openssldir="$INSTALL_DIR/openssl" \
                        shared 2>&1 | tail -1
                    make -j"$(nproc)" 2>&1 | tail -1
                    sudo make install 2>&1 | tail -1
                    echo "$INSTALL_DIR/openssl/lib" | sudo tee /etc/ld.so.conf.d/scraper-openssl.conf >/dev/null
                    sudo ldconfig
                    sudo rm -rf /tmp/openssl-1.1.1w /tmp/openssl-1.1.1w.tar.gz
                    OPENSSL_PREFIX="$INSTALL_DIR/openssl"
                    log_ok "OpenSSL 1.1.1 compiled from source"
                fi

                cd /tmp
                wget -q https://www.python.org/ftp/python/3.11.9/Python-3.11.9.tgz
                sudo rm -rf /tmp/Python-3.11.9
                tar xzf Python-3.11.9.tgz
                cd Python-3.11.9

                local configure_args="--prefix=$INSTALL_DIR/python3 --with-ensurepip=install"
                if [ -n "$OPENSSL_PREFIX" ]; then
                    export LDFLAGS="-L$OPENSSL_PREFIX/lib -Wl,-rpath,$OPENSSL_PREFIX/lib"
                    export CPPFLAGS="-I$OPENSSL_PREFIX/include"
                    configure_args="$configure_args --with-openssl=$OPENSSL_PREFIX"
                fi

                ./configure $configure_args 2>&1 | tail -1
                make -j"$(nproc)" 2>&1 | tail -1
                sudo make altinstall 2>&1 | tail -1
                sudo rm -rf /tmp/Python-3.11.9 /tmp/Python-3.11.9.tgz

                if [ -x "$INSTALL_DIR/python3/bin/python3.11" ]; then
                    PYTHON_CMD="$INSTALL_DIR/python3/bin/python3.11"
                    log_ok "Python 3.11 compiled from source"
                fi
            fi
            ;;
        apt)
            sudo apt-get install -y python3.11 python3.11-venv python3-pip 2>&1 | tail -1 \
                || sudo apt-get install -y python3 python3-venv python3-pip 2>&1 | tail -1
            if command -v python3.11 &>/dev/null; then
                PYTHON_CMD="python3.11"
            else
                PYTHON_CMD="python3"
            fi
            ;;
    esac

    if [ -n "$PYTHON_CMD" ] && command -v "$PYTHON_CMD" &>/dev/null; then
        log_ok "Python installed: $($PYTHON_CMD --version 2>&1)"
    else
        log_error "Python installation failed"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Google Chrome (headless, for Selenium/Playwright scraping)
# ---------------------------------------------------------------------------
install_chrome() {
    if [ "$INSTALL_CHROME" = false ]; then
        log_skip "Chrome (--no-chrome specified)"
        return
    fi

    if command -v google-chrome-stable &>/dev/null || command -v google-chrome &>/dev/null || command -v chromium-browser &>/dev/null; then
        local chrome_cmd
        chrome_cmd=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium-browser)
        log_ok "Chrome already installed: $($chrome_cmd --version 2>/dev/null || echo 'version unknown')"
        return
    fi

    log_install "Chrome (headless)..."
    case "$PKG_MGR" in
        dnf|yum)
            curl -sSL -o /tmp/chrome.rpm https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm 2>/dev/null
            if [ -f /tmp/chrome.rpm ]; then
                sudo $PKG_MGR localinstall -y /tmp/chrome.rpm 2>&1 | tail -1 || true
                rm -f /tmp/chrome.rpm
            fi
            ;;
        apt)
            # Try chromium first (easier), then Google Chrome
            sudo apt-get install -y chromium-browser 2>/dev/null \
                || sudo apt-get install -y chromium 2>/dev/null \
                || {
                    curl -sSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb 2>/dev/null
                    sudo dpkg -i /tmp/chrome.deb 2>/dev/null || sudo apt-get install -f -y
                    rm -f /tmp/chrome.deb
                }
            ;;
    esac

    if command -v google-chrome-stable &>/dev/null || command -v chromium-browser &>/dev/null; then
        log_ok "Chrome installed"
    else
        log_error "Chrome installation failed (non-fatal, requests/Playwright modes still work)"
    fi
}

# ---------------------------------------------------------------------------
# Scraper Agent Setup
# ---------------------------------------------------------------------------
setup_agent() {
    log_install "Scraper agent environment..."

    sudo mkdir -p "$INSTALL_DIR"

    # Download scraper package from S3 if specified
    if [ -n "$S3_PACKAGE" ]; then
        log "Downloading scraper package from S3: $S3_PACKAGE"
        if command -v aws &>/dev/null; then
            sudo aws s3 cp "$S3_PACKAGE" /tmp/scraper-agent.tar.gz 2>&1 | tail -1
        else
            sudo curl -sSL -o /tmp/scraper-agent.tar.gz "$S3_PACKAGE"
        fi
        if [ -f /tmp/scraper-agent.tar.gz ]; then
            sudo tar xzf /tmp/scraper-agent.tar.gz -C "$INSTALL_DIR/"
            rm -f /tmp/scraper-agent.tar.gz
            log_ok "Scraper package extracted to $INSTALL_DIR"
        fi
    fi

    # Create venv (or reuse AMI-baked one)
    if [ ! -d "$INSTALL_DIR/.venv" ]; then
        sudo "$PYTHON_CMD" -m venv "$INSTALL_DIR/.venv"
        log_ok "Python venv created"
    else
        log_ok "Python venv already exists (AMI or previous run)"
    fi

    # Install/upgrade dependencies (常に実行 — requirements.txt 更新に追従)
    sudo "$INSTALL_DIR/.venv/bin/pip" install --quiet --upgrade pip 2>&1 | tail -1
    if [ -f "$INSTALL_DIR/requirements.txt" ]; then
        sudo "$INSTALL_DIR/.venv/bin/pip" install --quiet -r "$INSTALL_DIR/requirements.txt" 2>&1 | tail -1
        log_ok "Python dependencies installed (from requirements.txt)"
    else
        sudo "$INSTALL_DIR/.venv/bin/pip" install --quiet psutil requests beautifulsoup4 lxml pdfplumber 2>&1 | tail -1
        log_ok "Minimal Python dependencies installed"
    fi

    # Ensure run_task.py and check_resources.py exist
    if [ ! -f "$INSTALL_DIR/run_task.py" ]; then
        log "Warning: run_task.py not found at $INSTALL_DIR/run_task.py"
        log "Upload scraper code via: --s3-package or manual scp"
    fi

    if [ ! -f "$INSTALL_DIR/check_resources.py" ]; then
        # Create a minimal check_resources.py inline
        sudo tee "$INSTALL_DIR/check_resources.py" > /dev/null << 'PYEOF'
#!/usr/bin/env python3
"""CPU/memory/disk load as JSON."""
import json, psutil
print(json.dumps({
    "cpu_percent": psutil.cpu_percent(interval=1),
    "memory_percent": psutil.virtual_memory().percent,
    "memory_available_mb": round(psutil.virtual_memory().available / 1e6),
    "disk_percent": psutil.disk_usage("/").percent,
    "load_avg_1m": round(psutil.getloadavg()[0], 2),
}))
PYEOF
        sudo chmod +x "$INSTALL_DIR/check_resources.py"
        log_ok "check_resources.py created"
    fi
}

# ---------------------------------------------------------------------------
# Docker Image Pull (ECR)
# ---------------------------------------------------------------------------
pull_docker_image() {
    if [ -z "$ECR_IMAGE" ]; then
        log_skip "Docker image pull (--ecr-image not specified)"
        return
    fi

    if [ "$INSTALL_DOCKER" = false ] || ! command -v docker &>/dev/null; then
        log_skip "Docker image pull (Docker not available)"
        return
    fi

    log_install "Pulling Docker image: $ECR_IMAGE"

    # ECR ログイン (AWS CLI が必要)
    if command -v aws &>/dev/null; then
        local ecr_registry
        ecr_registry=$(echo "$ECR_IMAGE" | cut -d'/' -f1)
        aws ecr get-login-password --region "$AWS_REGION" \
            | sudo docker login --username AWS --password-stdin "$ecr_registry" 2>&1 | tail -1
    else
        log "Warning: AWS CLI not available, attempting pull without ECR login"
    fi

    if sudo docker pull "$ECR_IMAGE" 2>&1 | tail -3; then
        log_ok "Docker image pulled: $ECR_IMAGE"
    else
        log_error "Docker image pull failed (non-fatal, Python mode available)"
    fi
}

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
verify() {
    log "=== Verification ==="

    local status=0

    # Python
    if "$INSTALL_DIR/.venv/bin/python" --version &>/dev/null; then
        log_ok "Python venv: $($INSTALL_DIR/.venv/bin/python --version 2>&1)"
    else
        log_error "Python venv not working"
        status=1
    fi

    # psutil
    if "$INSTALL_DIR/.venv/bin/python" -c "import psutil; print(f'psutil {psutil.__version__}')" 2>/dev/null; then
        log_ok "psutil available"
    else
        log_error "psutil not available"
        status=1
    fi

    # Resource check
    if "$INSTALL_DIR/.venv/bin/python" "$INSTALL_DIR/check_resources.py" &>/dev/null; then
        local metrics
        metrics=$("$INSTALL_DIR/.venv/bin/python" "$INSTALL_DIR/check_resources.py")
        log_ok "Resource check works: $metrics"
    else
        log_error "Resource check failed"
        status=1
    fi

    # Docker
    if command -v docker &>/dev/null && sudo docker info &>/dev/null; then
        log_ok "Docker running"
        # Docker image
        if [ -n "$ECR_IMAGE" ] && sudo docker image inspect "$ECR_IMAGE" &>/dev/null; then
            log_ok "Docker image available: $ECR_IMAGE"
        elif [ -n "$ECR_IMAGE" ]; then
            log "Warning: Docker image $ECR_IMAGE not found locally"
        fi
    elif [ "$INSTALL_DOCKER" = true ]; then
        log "Warning: Docker not running (may need logout/login for group changes)"
    fi

    # Chrome
    if command -v google-chrome-stable &>/dev/null || command -v chromium-browser &>/dev/null; then
        log_ok "Chrome available"
    elif [ "$INSTALL_CHROME" = true ]; then
        log "Warning: Chrome not available (Selenium mode may not work)"
    fi

    # run_task.py
    if [ -f "$INSTALL_DIR/run_task.py" ]; then
        log_ok "run_task.py present"
    else
        log "Warning: run_task.py not present (upload scraper code)"
    fi

    return $status
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log "============================================"
    log " SkillRelay Scraper Agent Setup"
    log "============================================"

    sudo mkdir -p "$(dirname "$LOG_FILE")"

    detect_os
    detect_pkg_manager

    log "--- Phase 1: System packages ---"
    pkg_update

    log "--- Phase 2: Docker ---"
    install_docker

    log "--- Phase 3: Python ---"
    install_python

    log "--- Phase 4: Chrome ---"
    install_chrome

    log "--- Phase 5: Agent environment ---"
    setup_agent

    log "--- Phase 6: Docker image ---"
    pull_docker_image

    log "--- Phase 7: Verification ---"
    verify

    log ""
    log "============================================"
    log " Setup complete!"
    log " Install dir: $INSTALL_DIR"
    log " Log file:    $LOG_FILE"
    log "============================================"
}

main "$@"
