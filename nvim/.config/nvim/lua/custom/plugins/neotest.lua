return {
  {
    'nvim-neotest/neotest',
    event = 'VeryLazy',
    dependencies = {
      'nvim-neotest/nvim-nio',
      'nvim-lua/plenary.nvim',
      'antoinemadec/FixCursorHold.nvim',
      'nvim-treesitter/nvim-treesitter',

      'nvim-neotest/neotest-plenary',
      'nvim-neotest/neotest-vim-test',

      {
        'echasnovski/mini.indentscope',
        opts = function()
          -- disable indentation scope for the neotest-summary buffer
          vim.cmd [[
        autocmd Filetype neotest-summary lua vim.b.miniindentscope_disable = true
      ]]
        end,
      },
    },
    opts = {
      -- See all config options with :h neotest.Config
      discovery = {
        -- Number of workers to parse files concurrently. 0
        -- automatically assigns number based on CPU. Set to 1 if experiencing lag.
        concurrent = 0,
      },
      running = {
        -- Run tests concurrently when an adapter provides multiple commands to run
        concurrent = false,
      },
      summary = {
        -- Enable/disable animation of icons
        animated = false,
      },
    },
    keys = require('config.keymaps.neotest').setup_neotest_keymaps(),
  },
}
