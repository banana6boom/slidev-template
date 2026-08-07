#!/bin/bash
set -euo pipefail

BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
DIM='\033[2m'
RESET='\033[0m'

step() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✔ $1${RESET}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${RESET}"; }
info() { echo -e "  ${DIM}$1${RESET}"; }

if [ -f .devcontainer/.env ]; then
  step "Loading .env configuration"
  source .devcontainer/.env
  ok "Done"
fi

if [ "${INSTALL_STARSHIP:-false}" = "true" ]; then
  step "Installing Starship prompt"
  if curl -fsSL https://starship.rs/install.sh | sh -s -- -y; then
    echo 'eval "$(starship init zsh)"' >> ~/.zshrc
    mkdir -p ~/.config
    starship preset catppuccin-powerline -o ~/.config/starship.toml
    ok "Starship installed and configured"
  else
    warn "Failed to install Starship — skipping prompt setup"
  fi
fi

if [ "${INSTALL_NODE:-false}" = "true" ]; then
  step "Installing Node.js"
  VERSION=$(cat .nvmrc)
  info "Target version: $VERSION"
  export NVM_DIR="/usr/local/share/nvm"
  set +euo pipefail
  source "$NVM_DIR/nvm.sh"
  nvm install "$VERSION"
  nvm alias default "$VERSION"
  set -euo pipefail
  ok "Node.js $VERSION installed"
fi

if [ "${INSTALL_PLAYWRIGHT_BROWSER:-false}" = "true" ]; then
  step "Installing Playwright Chromium (PDF export)"
  # Версия CLI синхронизируется с playwright-chromium из package.json:
  # у каждой версии Playwright своя ревизия браузера
  PW_VERSION=$(node -p "require('./package.json').devDependencies['playwright-chromium'].replace('^','')")
  # Сначала системные библиотеки: без них скачанный браузер падает
  # с «error while loading shared libraries: libnspr4.so».
  # Требует sudo, поэтому только здесь — вручную участник это сделать не сможет
  if sudo npx -y "playwright@${PW_VERSION}" install-deps chromium; then
    ok "Playwright system dependencies installed"
  else
    warn "Failed to install Playwright system libs — PDF export may not work"
  fi

  if npx -y "playwright@${PW_VERSION}" install chromium; then
    ok "Chromium installed (playwright ${PW_VERSION})"
  else
    warn "Failed to install Chromium — run manually: npx playwright install chromium"
  fi
fi

if [ "${LINK_HOST_HOME:-false}" = "true" ]; then
  # Создаём симлинк хостового HOME, чтобы абсолютные пути из WSL
  # резолвились в контейнере без мутации общих файлов через bind mount
  step "Linking host HOME for path compatibility"
  if [ -n "${HOST_USER_HOME:-}" ] && [ "$HOST_USER_HOME" != "$HOME" ] && [ ! -e "$HOST_USER_HOME" ]; then
    sudo mkdir -p "$(dirname "$HOST_USER_HOME")"
    sudo ln -sf "$HOME" "$HOST_USER_HOME"
    ok "Symlinked $HOST_USER_HOME → $HOME"
  else
    info "No symlink needed (host HOME=${HOST_USER_HOME:-unset}, container HOME=$HOME)"
  fi
fi

if [ "${INSTALL_CLAUDE:-false}" = "true" ]; then
  step "Installing Claude Code"
  if [ ! -f ~/.claude.json ]; then
    echo '{"hasCompletedOnboarding":true}' > ~/.claude.json
  fi
  if curl -fsSL https://claude.ai/install.sh | bash; then
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
    ok "Claude Code installed"
  else
    warn "Failed to install Claude Code — you can install it manually later"
  fi
fi

if [ "${INSTALL_TERMINAL_TOOLS:-false}" = "true" ]; then
  step "Installing terminal tools (eza, fzf, bat, zsh-autosuggestions)"

  mkdir -p ~/.local/bin ~/.zsh

  # Образ мультиарховый (amd64 + arm64), а релизы этих утилит собраны под
  # конкретную архитектуру: без выбора на Apple Silicon скачался бы x86_64
  case "$(uname -m)" in
    aarch64 | arm64)
      EZA_ARCH="aarch64-unknown-linux-gnu"
      DEB_ARCH="arm64"
      ;;
    *)
      EZA_ARCH="x86_64-unknown-linux-gnu"
      DEB_ARCH="amd64"
      ;;
  esac

  # eza — modern ls replacement with icons
  if curl -fsSL -o /tmp/eza.tar.gz "https://github.com/eza-community/eza/releases/latest/download/eza_${EZA_ARCH}.tar.gz"; then
    tar -xzf /tmp/eza.tar.gz -C ~/.local/bin/
    chmod +x ~/.local/bin/eza
    ok "eza installed"
  else
    warn "Failed to install eza — skipping"
  fi

  # bat — cat with syntax highlighting
  BAT_VERSION=$(curl -fsSL https://api.github.com/repos/sharkdp/bat/releases/latest | grep -oP '"tag_name":\s*"v?\K[^"]+')
  if [ -n "$BAT_VERSION" ] && curl -fsSL -o /tmp/bat.deb "https://github.com/sharkdp/bat/releases/download/v${BAT_VERSION}/bat_${BAT_VERSION}_${DEB_ARCH}.deb"; then
    sudo dpkg -i /tmp/bat.deb || warn "dpkg failed for bat — skipping"
    ok "bat installed"
  else
    warn "Failed to install bat — skipping"
  fi

  # fzf — fuzzy finder
  if git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf; then
    ~/.fzf/install --all
    ok "fzf installed"
  else
    warn "Failed to install fzf — skipping"
  fi

  # zsh-autosuggestions — fish-like suggestions from history
  if git clone --depth 1 https://github.com/zsh-users/zsh-autosuggestions.git ~/.zsh/zsh-autosuggestions; then
    echo 'source ~/.zsh/zsh-autosuggestions/zsh-autosuggestions.zsh' >> ~/.zshrc
    ok "zsh-autosuggestions installed"
  else
    warn "Failed to install zsh-autosuggestions — skipping"
  fi

  # Aliases and history settings
  cat >> ~/.zshrc << 'ALIASES'

# eza aliases
alias ls='eza --icons'
alias ll='eza --icons -la'
alias la='eza --icons -a'
alias l='eza --icons'
alias lt='eza --icons --tree --level=2'

# bat alias
alias cat='bat --paging=never'

# history
HISTSIZE=10000
SAVEHIST=20000
ALIASES

  ok "Aliases and history configured"
fi

step "Installed versions"
echo -e "  Node.js:    ${BOLD}$(node -v)${RESET}"
echo -e "  npm:        ${BOLD}$(npm -v)${RESET}"
echo -e "  pnpm:       ${BOLD}$(pnpm -v 2>/dev/null || echo 'not found')${RESET}"
command -v starship > /dev/null && echo -e "  Starship:   ${BOLD}$(starship --version)${RESET}" || info "Starship: not installed"
command -v claude > /dev/null && echo -e "  Claude Code: ${BOLD}$(claude --version)${RESET}" || info "Claude Code: not installed"

step "Дальше"
info "pnpm install            # зависимости (~1 минута)"
info "pnpm lecture 01-intro   # запустить первую лекцию"
