return {
  { -- Useful plugin to show you pending keybinds.
    'folke/which-key.nvim',
    event = 'VeryLazy',
    opts = {
      spec = {
        { '<leader>s', group = '[S]earch' },
        { '<leader>c', group = '[C]ode' },
        { '<leader>d', group = '[D]ocument' },
        { '<leader>r', group = '[R]ename' },
        { '<leader>w', group = '[W]orkspace' },
        { '<leader>t', group = '[t]esting' },
        { '<leader>T', group = '[T]oggle' },
        { '<leader>h', group = 'Git [H]unk' },
        { '<leader>h', group = 'Git [H]unk', mode = 'v' },
      },
    },
  },
}
