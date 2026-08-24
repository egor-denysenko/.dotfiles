return {
  { -- Parser management and queries for Neovim's built-in treesitter
    'nvim-treesitter/nvim-treesitter',
    branch = 'main',
    lazy = false,
    build = ':TSInstall',
    config = function()
      require('nvim-treesitter').setup {
        install_dir = vim.fn.stdpath('data') .. '/site',
      }

      -- Install parsers (async, no-op if already present)
      require('nvim-treesitter').install {
        'bash',
        'c',
        'diff',
        'dockerfile',
        'git_config',
        'gitcommit',
        'git_rebase',
        'go',
        'gomod',
        'html',
        'javascript',
        'json',
        'lua',
        'luadoc',
        'make',
        'markdown',
        'markdown_inline',
        'mermaid',
        'python',
        'sql',
        'toml',
        'tsx',
        'typescript',
        'typst',
        'vim',
        'vimdoc',
        'yaml',
      }

      -- Enable treesitter highlighting for all filetypes that have a parser available.
      -- Neovim 0.12 already enables it for lua, markdown, help, query via bundled ftplugins;
      -- this autocmd covers every other language automatically.
      vim.api.nvim_create_autocmd('FileType', {
        group = vim.api.nvim_create_augroup('ts-highlight', { clear = true }),
        callback = function(ev)
          local buf = ev.buf
          -- Skip if treesitter highlighting is already active for this buffer.
          if vim.b[buf]._ts_hl then
            return
          end
          local lang = vim.treesitter.language.get_lang(ev.match)
          if not lang then
            return
          end
          -- Only start if the parser is actually installed and start succeeds.
          if pcall(vim.treesitter.language.add, lang) and pcall(vim.treesitter.start, buf, lang) then
            vim.b[buf]._ts_hl = true
          end
        end,
      })

      -- Treesitter-based indentation (experimental; skip Ruby which needs regex indent).
      vim.api.nvim_create_autocmd('FileType', {
        group = vim.api.nvim_create_augroup('ts-indent', { clear = true }),
        callback = function(ev)
          if ev.match == 'ruby' then
            return
          end
          local lang = vim.treesitter.language.get_lang(ev.match)
          if not lang then
            return
          end
          if pcall(vim.treesitter.language.add, lang) then
            vim.bo[ev.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
          end
        end,
      })
    end,
  },
}
-- vim: ts=2 sts=2 sw=2 et
