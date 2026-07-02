return {
  {
    -- Set lualine as statusline
    'nvim-lualine/lualine.nvim',
    -- See `:help lualine.txt`
    opts = {
      options = {
        icons_enabled = vim.g.have_nerd_font,
        theme = 'auto', -- auto matches the one from colorscheme  NOTE: Check available themes here https://github.com/nvim-lualine/lualine.nvim?tab=readme-ov-file#screenshots
        component_separators = '|',
        section_separators = '',
      },
    },
  },
}
