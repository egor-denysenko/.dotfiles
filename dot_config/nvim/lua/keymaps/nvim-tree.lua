-- Keybindings
vim.keymap.set('n', '<leader>n', ':NvimTreeToggle<CR>', { desc = 'Toggle nvim-tree' })
-- <leader>e is taken by diagnostics (open_float). Use <leader>E for tree focus.
vim.keymap.set('n', '<leader>E', ':NvimTreeFocus<CR>', { desc = 'Focus nvim-tree' })
-- Note: <leader>f is already used by conform.nvim for formatting.
-- Use `nf` for find-file instead.
vim.keymap.set('n', '<leader>nf', ':NvimTreeFindFile<CR>', { desc = '[N]vim-tree [F]ind file' })
