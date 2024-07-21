-- NOTE: Plugins can also be configured to run Lua code when they are loaded.
--
-- This is often very useful to both group configuration, as well as handle
-- lazy loading plugins that don't need to be loaded immediately at startup.
--
-- For example, in the following configuration, we use:
--  event = 'VimEnter'
--
-- which loads which-key before all the UI elements are loaded. Events can be
-- normal autocommands events (`:help autocmd-events`).
--
-- Then, because we use the `config` key, the configuration only runs
-- after the plugin has been loaded:
--  config = function() ... end

return {
  { -- Useful plugin to show you pending keybinds.
    'folke/which-key.nvim',
    event = 'VimEnter', -- Sets the loading event to 'VimEnter'
    config = function() -- This is the function that runs, AFTER loading
      local wk = require 'which-key'

      -- Document existing selection groups
      wk.add {
        { '<leader>s', desc = '', group = '[S]earch' },
        { '<leader>c', desc = '', group = '[C]ode' },
        { '<leader>d', desc = '', group = '[D]ocument' },
        { '<leader>r', desc = '', group = '[R]ename' },
        { '<leader>s', desc = '', group = '[S]earch' },
        { '<leader>w', desc = '', group = '[W]orkspace' },
        { '<leader>t', desc = '', group = '[t]esting' },
        { '<leader>T', desc = '', group = '[T]oggle' },
        { '<leader>h', desc = '', group = 'Git [H]unk' },
      }

      -- visual mode command selection
      wk.add {
        { '<leader>h', desc = '', group = 'Git [H]unk', mode = 'v' },
      }
    end,
  },
}
-- vim: ts=2 sts=2 sw=2 et
