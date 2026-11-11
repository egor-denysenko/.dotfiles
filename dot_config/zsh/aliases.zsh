# Aliases
alias l="ls -lah"

alias vim="nvim"
alias mux="zellij"

# Use ripgrep as grep if available (faster, .gitignore-aware)
if command -v rg &> /dev/null; then
  alias grep='rg'
fi

