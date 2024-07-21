# Personal dotfiles config

In order to start using this dotfiles i reccomend using [stow](gnu.org/software/stow) in order to create simlinks easily

Sparse checkoout:

In some cases some configurations should be avoided to be propagated to new machines:

Make sure that sparse checkout is enabled `git config --global core.sparseCheckout true`

```bash
    git clone --no-checkout --depth 1 --sparse --filter=blob:none \
    https://github.com/egor-denysenko/.dotfiles.git

    cd .dotfiles/

    git sparse-checkout init --cone

    # example sparse-checkout without .git info
    git sparse-checkout add nvim  README.md  scripts  starship  sway  wezterm  zellij  zsh # select interested repositories 
    cat .git/info/sparse-checkout   # to verify

    git checkout main # should take only a moment

```

Example config without 

In order to see before applying the changes with stow you can use ```stow -nv```

Quick reference:
- Clone in a different floder from .config found in you're $HOME
- Transfer config to local machine  ```stow -Svt ~ */``` Instead of * the single folders can be linked
- Unlink stow config ```stow -Dvt ~ */```
