# Porchetto's personal dotfiles

in order to start using this dotfiles i reccomend using [stow](gnu.org/software/stow) in order to create simlinks easily

in order to see before applying the changes with stow you can use ```stow -nv```

Quick reference:
- Transfer config to local machine  ```stow --adopt -Svt ~ *``` Instead of * the single folders can be linked --adopt flag moves the current config into the dotfiles folder
- Unlink stow config ```stow -Dvt ~ *```