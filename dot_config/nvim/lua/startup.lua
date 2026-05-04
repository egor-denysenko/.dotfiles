-- startup.lua — :ThisIsFine command (centered floating terminal)
local art = vim.fn.stdpath('config') .. '/utils/thisisfine.sh'

vim.api.nvim_create_user_command('ThisIsFine', function()
  if vim.fn.filereadable(art) ~= 1 then
    vim.notify('thisisfine.sh not found', vim.log.levels.WARN)
    return
  end

  local buf = vim.api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = 'wipe'

  local w = math.min(84, vim.o.columns - 4)
  local h = math.min(28, vim.o.lines - 4)
  local win = vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = w,
    height = h,
    row = math.floor((vim.o.lines - h) / 2),
    col = math.floor((vim.o.columns - w) / 2),
    style = 'minimal',
    border = 'rounded',
  })

  -- bash -c ensures read -s -n1 works (zsh uses different read flags)
  vim.fn.termopen('bash ' .. vim.fn.shellescape(art) .. '; echo; echo -n "  Press any key to close  "; bash -c "read -s -n1"', {
    on_exit = function()
      if vim.api.nvim_win_is_valid(win) then
        vim.api.nvim_win_close(win, true)
      end
    end,
  })
  vim.cmd('startinsert')
end, { desc = 'Show This is Fine ANSI art' })
