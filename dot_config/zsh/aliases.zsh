# Aliases
alias l="ls -lah"

alias vim="nvim"
alias mux="zellij"

alias air='/home/bronco/go/bin/air'

alias pd='podman-compose'
alias pdup='podman-compose up'

# Use ripgrep as grep if available (faster, .gitignore-aware)
if command -v rg &> /dev/null; then
  alias grep='rg'
fi
