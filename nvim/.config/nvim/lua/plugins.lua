-- Abbreviate vim.fn
local fn = vim.fn

-- Declare installation path of packer plugin manager in case it is missing on the system
local install_path = fn.stdpath "data" .. "/site/pack/packer/start/packer.nvim"

-- Auto install if not present packer plugin manager
if fn.empty(fn.glob(install_path)) > 0 then
  PACKER_BOOTSTRAP = fn.system {
    "git",
    "clone",
    "--depth",
    "1",
    "https://github.com/wbthomason/packer.nvim",
    install_path,
  }
  print "Installing packer close and reopen Neovim..."
  vim.cmd [[packadd packer.nvim]]
end

-- Autocommand that reloads neovim whenever you save the plugins.lua file
vim.cmd [[
  augroup packer_user_config
    autocmd!
    autocmd BufWritePost plugins.lua source <afile> | PackerSync
  augroup end
]]

-- Use a protected call so we don't error out on first use
local status_ok, packer = pcall(require, "packer")
if not status_ok then
  return
end

-- Have packer use a popup window
packer.init {
  display = {
    open_fn = function()
      return require("packer.util").float { border = "rounded" }
    end,
  },
}

-- Install your plugins here
-- Plugins Are installed in the following path ~/.local/share/nvim/site/pack/packer/start
return packer.startup(function(use)
  -- My plugins here
  use "wbthomason/packer.nvim" -- Have packer manage itself
  use "nvim-lua/popup.nvim" -- An implementation of the Popup API from vim in Neovim
  use "nvim-lua/plenary.nvim" -- Useful lua functions used ny lots of plugins

  -- Colorschemes
  use "folke/tokyonight.nvim" -- Tokio color scheme

  -- Autocompletion
  use "hrsh7th/nvim-cmp" -- Installing nvim-cmp completion
  use ({"hrsh7th/cmp-buffer", requires = {"hrsh7th/nvim-cmp"}})
  use ({"hrsh7th/cmp-path", requires = {"hrsh7th/nvim-cmp"}})
  use ({"hrsh7th/cmp-cmdline", requires = {"hrsh7th/nvim-cmp"}})
  use "hrsh7th/cmp-nvim-lsp"
  use "hrsh7th/cmp-nvim-lua"

  -- General Snippets
  use "rafamadriz/friendly-snippets" -- a bunch of snippets to use
  -- Lua Snippets
  use "L3MON4D3/LuaSnip"

  -- Golang Snippets
  use "ray-x/go.nvim"
  use "ray-x/guihua.lua"

  -- LSP
  use "neovim/nvim-lspconfig" -- enable LSP
  use "williamboman/nvim-lsp-installer" -- simple to use language server installer

  -- LSP Error Checking
  use ({"folke/trouble.nvim",
  requires = "kyazdani42/nvim-web-devicons",
    config = function()
      require("trouble").setup {
        -- your configuration comes here
        -- or leave it empty to use the default settings
      }
    end
  });

  -- Telescope
  use "nvim-telescope/telescope.nvim"
  use 'nvim-telescope/telescope-media-files.nvim'

  -- Automatically set up your configuration after cloning packer.nvim
  -- Put this at the end after all plugins
  if PACKER_BOOTSTRAP then
    require("packer").sync()
  end
end)
