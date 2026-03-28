M = {}

function M.setup_neotest_keymaps()
  return {
    {
      '<leader>ta',
      function()
        require('neotest').run.attach()
      end,
      desc = 'Neotest [a]ttach to nearest test',
    },
    {
      '<leader>tf',
      function()
        require('neotest').run.run(vim.fn.expand '%')
      end,
      desc = 'Run File',
    },
    {
      '<leader>tA',
      function()
        require('neotest').run.run(vim.uv.cwd())
      end,
      desc = 'Run All Test Files',
    },
    {
      '<leader>tT',
      function()
        require('neotest').run.run { suite = true }
      end,
      desc = 'Run Test Suite',
    },
    {
      '<leader>tn',
      function()
        require('neotest').run.run()
      end,
      desc = 'Run Nearest',
    },
    {
      '<leader>tl',
      function()
        require('neotest').run.run_last()
      end,
      desc = 'Run Last',
    },
    {
      '<leader>ts',
      function()
        require('neotest').summary.toggle()
      end,
      desc = 'Toggle Summary',
    },
    {
      '<leader>to',
      function()
        require('neotest').output.open { enter = true, auto_close = true }
      end,
      desc = 'Show Output',
    },
    {
      '<leader>tO',
      function()
        require('neotest').output_panel.toggle()
      end,
      desc = 'Toggle Output Panel',
    },
    {
      '<leader>tt',
      function()
        require('neotest').run.stop()
      end,
      desc = 'Terminate',
    },
    {
      '<leader>td',
      function()
        -- FIXME: do the operation conditionally
        --vim.cmd 'Neotree close'
        require('neotest').summary.close()
        require('neotest').output_panel.close()
        require('neotest').run.run { suite = false, strategy = 'dap' }
      end,
      desc = 'Debug nearest test',
    },
  }
end

return M
