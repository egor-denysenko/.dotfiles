local renderers = require('diagram.renderers')

local M = {
  id = 'mermaid-file',
  filetypes = { 'mermaid' },
  renderers = { renderers.mermaid },
}

M.query_buffer_diagrams = function(bufnr)
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  local source = table.concat(lines, '\n')
  if vim.trim(source) == '' then
    return {}
  end

  -- Treat standalone Mermaid buffers as a single diagram.
  return {
    {
      bufnr = bufnr,
      renderer_id = renderers.mermaid.id,
      source = source,
      range = {
        start_row = 0,
        start_col = 0,
        end_row = math.max(#lines - 1, 0),
        end_col = #(lines[#lines] or ''),
      },
    },
  }
end

return M
