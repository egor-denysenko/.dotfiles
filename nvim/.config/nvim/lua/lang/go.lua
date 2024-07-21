vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'go', 'gomod', 'gowork', 'gotmpl' },
  callback = function()
    -- set go specific options
    vim.opt_local.tabstop = 2
    vim.opt_local.shiftwidth = 2
    vim.opt_local.shiftwidth = 2
    --vim.opt_local.colorcolumn = '120'
  end,
})

return {
  {
    'ray-x/go.nvim',
    dependencies = { -- optional packages
      'ray-x/guihua.lua',
      'neovim/nvim-lspconfig',
      'nvim-treesitter/nvim-treesitter',
    },
    config = function()
      require('go').setup()
    end,
    event = { 'CmdlineEnter' },
    ft = { 'go', 'gomod' },
    build = ':lua require("go.install").update_all_sync()', -- if you need to install/update all binaries
  },
  {
    'nvim-neotest/neotest',
    ft = { 'go' },
    dependencies = {
      'nvim-neotest/nvim-nio',
      'nvim-lua/plenary.nvim',
      'antoinemadec/FixCursorHold.nvim',
      'nvim-treesitter/nvim-treesitter',
      'fredrikaverpil/neotest-golang',
    },
    config = function()
      require('neotest').setup {
        adapters = {
          require 'neotest-golang', -- Registration
        },
      }
    end,
    opts = function(_, opts)
      opts.adapters = opts.adapters or {}
      opts.adapters['neotest-golang'] = {
        dev_notifications = true,
        go_test_args = {
          '-v',
          '-count=1',
          '-race',
          '-parallel=1',
          '-p=2',
          '-coverprofile=' .. vim.fn.getcwd() .. '/coverage.out',
        },
        dap_go_enabled = true,
      }
    end,
  },
  {
    'andythigpen/nvim-coverage',
    ft = { 'go' },
    dependencies = { 'nvim-lua/plenary.nvim' },
    opts = {
      -- https://github.com/andythigpen/nvim-coverage/blob/main/doc/nvim-coverage.txt
      auto_reload = true,
      lang = {
        go = {
          coverage_file = vim.fn.getcwd() .. '/coverage.out',
        },
      },
    },
  },
  {
    'mfussenegger/nvim-dap',
    ft = { 'go' },
    dependencies = {
      {
        'jay-babu/mason-nvim-dap.nvim',
        dependencies = {
          'williamboman/mason.nvim',
        },
        opts = {
          ensure_installed = { 'delve' },
        },
      },
      {
        'leoluz/nvim-dap-go',
        opts = {
          -- Additional dap configurations can be added.
          -- dap_configurations accepts a list of tables where each entry
          -- represents a dap configuration. For more details do:
          -- :help dap-configuration
          dap_configurations = {
            {
              -- Must be "go" or it will be ignored by the plugin
              type = 'go',
              name = 'Attach remote',
              mode = 'remote',
              request = 'attach',
            },
          },
          -- delve configurations
          delve = {
            -- the path to the executable dlv which will be used for debugging.
            -- by default, this is the "dlv" executable on your PATH.
            path = 'dlv',
            -- time to wait for delve to initialize the debug session.
            -- default to 20 seconds
            initialize_timeout_sec = 20,
            -- a string that defines the port to start delve debugger.
            -- default to string "${port}" which instructs nvim-dap
            -- to start the process in a random available port
            port = '${port}',
            -- additional args to pass to dlv
            args = {},
            -- the build flags that are passed to delve.
            -- defaults to empty string, but can be used to provide flags
            -- such as "-tags=unit" to make sure the test suite is
            -- compiled during debugging, for example.
            -- passing build flags using args is ineffective, as those are
            -- ignored by delve in dap mode.
            build_flags = '',
            -- whether the dlv process to be created detached or not. there is
            -- an issue on Windows where this needs to be set to false
            -- otherwise the dlv server creation will fail.
            detached = true,
            -- the current working directory to run dlv from, if other than
            -- the current working directory.
            cwd = nil,
          },
        },
      },
    },
    opts = {
      configurations = {
        go = {
          -- See require("dap-go") source for full dlv setup.
          {
            type = 'go',
            name = 'Debug test (manually enter test name)',
            request = 'launch',
            mode = 'test',
            program = './${relativeFileDirname}',
            args = function()
              local testname = vim.fn.input 'Test name (^regexp$ ok): '
              return { '-test.run', testname }
            end,
          },
        },
      },
    },
  },
}
