return {
  {
    'nvim-tree/nvim-tree.lua',
    version = '^1.15.0',
    lazy = false,
    dependencies = {
      'nvim-tree/nvim-web-devicons',
    },
    config = function()
      require('nvim-tree').setup {
        -- Keeps the cursor on the first letter of the filename when moving in the tree.
        hijack_cursor = true,
        -- Hijack netrw windows
        hijack_netrw = true,
        -- Show additional info
        view = {
          number = true,
          relativenumber = true,
          adaptive_size = true,
          width = {
            min = 30,
            max = 45,
          },
          side = 'right',
        },
        -- Hide .git folder and other unwanted files
        filters = {
          custom = { '^.git$', '.DS_Store', 'node_modules' },
          dotfiles = false,
        },
        -- Git integration
        git = {
          enable = true,
          ignore = true,
        },
        -- File system operations
        actions = {
          open_file = {
            resize_window = true,
            quit_on_open = true,
          },
          remove_file = {
            close_window = false,
          },
        },
        -- Update focus on file change
        update_focused_file = {
          enable = true,
          update_root = true,
          ignore_list = {},
        },
        -- Diagnostics
        diagnostics = {
          enable = false, -- Disable diagnostics to prevent sign errors
          show_on_dirs = false,
          debounce_delay = 50,
          icons = {
            hint = '',
            info = '',
            warning = '',
            error = '',
          },
        },
      }

      -- Auto-open nvim-tree on startup for directories
      local function open_nvim_tree(data)
        -- buffer is a real file on the disk
        local real_file = vim.fn.filereadable(data.file) == 1
        -- buffer is a [No Name]
        local no_name = data.file == '' and vim.bo[data.buf].buftype == ''
        -- buffer is a directory
        local directory = vim.fn.isdirectory(data.file) == 1

        if (not real_file and not no_name) or not directory then
          return
        end
        -- open the tree, find the file but don't focus it
        require('nvim-tree.api').tree.toggle { focus = false, find_file = true }
      end

      -- Auto-open on VimEnter
      vim.api.nvim_create_autocmd('VimEnter', { callback = open_nvim_tree })

      -- Auto-close NvimTree when it's the last remaining window.
      -- NOTE: We cannot call NvimTreeClose or nvim_win_close on the tree window
      -- inside QuitPre because NvimTree's internal WinClosed/BufUnload handlers
      -- cause a hang in that context. Instead, we bypass all autocmds with
      -- `noautocmd qall!` to cleanly exit.
      vim.api.nvim_create_autocmd('QuitPre', {
        callback = function()
          local wins = vim.api.nvim_list_wins()
          local tree_wins = 0
          local floating_wins = 0
          for _, w in ipairs(wins) do
            local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_win_get_buf(w))
            if bufname:match 'NvimTree_' then
              tree_wins = tree_wins + 1
            end
            if vim.api.nvim_win_get_config(w).relative ~= '' then
              floating_wins = floating_wins + 1
            end
          end
          -- If tree is open and only 0-1 real windows remain, quit everything
          if tree_wins > 0 and (#wins - floating_wins - tree_wins) <= 1 then
            pcall(vim.cmd, 'noautocmd qall!')
          end
        end,
      })
    end,
  },
}
