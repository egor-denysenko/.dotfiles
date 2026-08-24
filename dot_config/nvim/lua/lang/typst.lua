vim.api.nvim_create_autocmd('FileType', {
  pattern = { 'typst' },
  callback = function()
    vim.opt_local.tabstop = 2
    vim.opt_local.shiftwidth = 2
    vim.opt_local.expandtab = true
    vim.opt_local.colorcolumn = '120'
  end,
})

return {
  {
    'chomosuke/typst-preview.nvim',
    ft = 'typst',
    version = '1.*',
    opts = {
      open_cmd = nil, -- uses default browser / system handler
      get_root = function(path_of_main_file)
        local root = vim.fs.root(path_of_main_file, { '.git', 'Makefile', 'template.typ' })
        return root or vim.fs.dirname(path_of_main_file)
      end,
      dependencies_bin = {
        ['tinymist'] = 'tinymist',
        ['websocat'] = nil,
      },
    },
    keys = {
      { '<leader>tp', '<cmd>TypstPreviewToggle<cr>', desc = '[T]oggle Typst [P]review' },
    },
  },
  {
    'kaarmu/typst.vim',
    ft = 'typst',
    lazy = false,
  },
}
