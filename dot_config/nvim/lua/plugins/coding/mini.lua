return {
  { -- Better Around/Inside textobjects
    'echasnovski/mini.ai',
    event = 'VeryLazy',
    opts = { n_lines = 500 },
  },
  { -- Add/delete/replace surroundings (brackets, quotes, etc.)
    'echasnovski/mini.surround',
    event = 'VeryLazy',
    opts = {},
  },
  { -- Simple and easy statusline
    'echasnovski/mini.statusline',
    event = 'VimEnter',
    config = function()
      local statusline = require 'mini.statusline'
      statusline.setup { use_icons = vim.g.have_nerd_font }
      statusline.section_location = function()
        return '%2l:%-2v'
      end
    end,
  },
  { -- Simple and intuitive file explorer
    'echasnovski/mini.files',
    keys = {
      { '-', function() require('mini.files').open() end, desc = 'Open mini.files' },
    },
    opts = {},
  },
}
-- vim: ts=2 sts=2 sw=2 et
