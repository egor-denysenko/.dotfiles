# If you come from bash you might have to change your $PATH.
# export PATH=$HOME/bin:/usr/local/bin:$PATH

# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="mikeh"

# Uncomment the following line to change how often to auto-update (in days).
zstyle ':omz:update' frequency 7

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
# COMPLETION_WAITING_DOTS="true"

# Disable npm terminal ads
export ADBLOCK=true
export DISABLE_OPENCOLLECTIVE=true
export OPEN_SOURCE_CONTRIBUTOR=true
export OPENCOLLECTIVE_HIDE=true

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(
	git
	zsh-autosuggestions
	zsh-syntax-highlighting
	fast-syntax-highlighting
)

source $ZSH/oh-my-zsh.sh

. /usr/share/fzf/shell/key-bindings.zsh

# Aliases
alias l="ls -lah"
alias vim="nvim"
alias mux="zellij"
alias air='/home/bronco/go/bin/air'
alias pd='podman-compose'
alias pdup='podman-compose up'

# Env variables export
export SHELL="/bin/zsh"

export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

export GPG_TTY=$(tty)
export FLYCTL_INSTALL="/home/bronco/.fly"

export GOROOT=""
export GOPATH=$HOME/go
export GOPROXY="https://proxy.golang.org/"
export MAGEFILE_ENABLE_COLOR=true

# PATH related exports
export PATH="$FLYCTL_INSTALL/bin:$PATH"
export PATH=$PATH:/usr/local/go/bin
export PATH=$PATH:$GOPATH/bin

# Should be at EOF
eval "$(starship init zsh)"
