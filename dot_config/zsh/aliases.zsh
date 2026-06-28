# Check for GH CLI availability
if ! command -v gh &> /dev/null; then
  echo "Warning: GitHub CLI (gh) is not installed."
fi

# Aliases
alias l="ls -lah"

alias vim="nvim"
alias mux="zellij"

alias air='/home/bronco/go/bin/air'

pi() {
  case "$1" in
    install|remove|uninstall|update|list|config)
      command pi "$@"
      ;;
    *)
      command pi -t read,bash,edit,write,ls "$@"
      ;;
  esac
}

alias pd='podman-compose'
alias pdup='podman-compose up'

# Use ripgrep as grep if available (faster, .gitignore-aware)
if command -v rg &> /dev/null; then
  alias grep='rg'
fi

# Invoke a GH workflow from GH CLI
gh-work() {
  if [ "$#" -ne 3 ]; then
    echo "Usage: gh-work <repo-link> <workflow-name> <jira-ticket>"
    return 1
  fi

  local REPO=$1
  local WORKFLOW=$2
  local JIRA_TICKET=$3

  # Ensure gh cli is installed
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is not installed."
    return 1
  fi

  echo "Triggering workflow '$WORKFLOW' in repository '$REPO' with JIRA ticket '$JIRA_TICKET'..."
  gh workflow run "$WORKFLOW" --repo "$REPO" -f jira_ticket="$JIRA_TICKET"
}
