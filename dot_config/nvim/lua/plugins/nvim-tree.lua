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
        -- System integration
        system_open = {
          cmd = nil,
          args = {},
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

      -- Auto-close on quit
      vim.api.nvim_create_autocmd('QuitPre', {
        callback = function()
          vim.cmd 'NvimTreeClose'
        end,
      })
    end,
  },
}
