return {
  {
    '3rd/image.nvim',
    lazy = true,
    build = false,
    opts = function()
      return {
        backend = 'kitty',
        processor = 'magick_cli',
        -- Support all image formats
        content_types = { 'png', 'jpg', 'jpeg', 'gif', 'webp' },
        -- Smaller images for WezTerm
        max_width = 500,
        max_height = 250,
        -- Render images automatically (not just at cursor)
        integrations = {
          markdown = {
            only_render_image_at_cursor = false,
            filetypes = { 'markdown', 'vimwiki' },
          },
        },
      }
    end,
  },
  {
    '3rd/diagram.nvim',
    ft = { 'markdown', 'mermaid' },
    keys = {
      { '<leader>dr', function() require('diagram').render() end, desc = '[D]ocument [D]iagram [R]ender' },
      { '<leader>dh', function() require('diagram').show_diagram_hover() end, desc = '[D]ocument [D]iagram [H]over' },
      { '<leader>dc', function() require('diagram').clear() end, desc = '[D]ocument [D]iagram [C]lear' },
    },
    dependencies = {
      '3rd/image.nvim',
    },
    opts = {
      events = {
        -- Manual-only rendering; never render while editing unless explicitly requested.
        render_buffer = {},
        clear_buffer = { 'BufLeave', 'BufDelete' },
      },
      renderer_options = {
        mermaid = {
          theme = 'dark',
        },
      },
      image_options = {
        -- Clear images on scroll to prevent ghosting in WezTerm
        clear_on_scroll = true,
      },
    },
    config = function(_, opts)
      local mermaid = require('diagram.renderers').mermaid
      local cache_dir = vim.fn.resolve(vim.fn.stdpath('cache') .. '/diagram-cache/' .. mermaid.id)
      vim.fn.mkdir(cache_dir, 'p')

      if vim.fn.executable('mmdc') ~= 1 then
        vim.notify_once(
          'mmdc not found. Install with: bun install -g @mermaid-js/mermaid-cli',
          vim.log.levels.WARN,
          { title = 'diagram.nvim' }
        )
      end

      mermaid.render = function(source, options)
        options = options or {}

        local hash = vim.fn.sha256(mermaid.id .. ':' .. source)
        local path = vim.fn.resolve(cache_dir .. '/' .. hash .. '.png')
        if vim.fn.filereadable(path) == 1 then
          return { file_path = path }
        end

        if vim.fn.executable('mmdc') ~= 1 then
          vim.notify('mmdc not found. Install with: bun install -g @mermaid-js/mermaid-cli', vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end
        local command = { 'mmdc' }

        local tmpsource = vim.fn.tempname()
        vim.fn.writefile(vim.split(source, '\n'), tmpsource)

        if options.cli_args and #options.cli_args > 0 then
          vim.list_extend(command, options.cli_args)
        end

        vim.list_extend(command, { '-i', tmpsource, '-o', path })

        if options.background then
          vim.list_extend(command, { '-b', options.background })
        end
        if options.theme then
          vim.list_extend(command, { '-t', options.theme })
        end
        if options.scale then
          vim.list_extend(command, { '-s', tostring(options.scale) })
        end
        if options.width then
          vim.list_extend(command, { '--width', tostring(options.width) })
        end
        if options.height then
          vim.list_extend(command, { '--height', tostring(options.height) })
        end

        local render_done = false
        local render_error = nil

        local job_id = vim.fn.jobstart(command, {
          on_stderr = function(_, data)
            local error_msg = table.concat(data, '\n'):gsub('^%s+', ''):gsub('%s+$', '')
            if error_msg ~= '' then
              render_error = error_msg
            end
          end,
          on_exit = function(_, exit_code)
            render_done = true
            if exit_code ~= 0 then
              render_error = render_error or ('mmdc exited with code ' .. exit_code)
            end
          end,
        })

        if job_id == 0 then
          vim.notify('Failed to start mmdc: command not found in PATH=' .. vim.env.PATH, vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end
        if job_id == -1 then
          vim.notify('Failed to start mmdc: invalid arguments', vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end

        -- Wait for job to complete (diagram.nvim expects synchronous rendering)
        local timeout = 30000
        local elapsed = 0
        while not render_done and elapsed < timeout do
          vim.defer_fn(function() end, 100)
          vim.wait(100)
          elapsed = elapsed + 100
        end

        if not render_done then
          vim.notify('mmdc timed out after ' .. timeout .. 'ms', vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end

        if render_error then
          vim.notify('Failed to render diagram: ' .. render_error, vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end

        if vim.fn.filereadable(path) ~= 1 then
          vim.notify('mmdc completed but output file not created: ' .. path, vim.log.levels.ERROR, { title = 'diagram.nvim' })
          return nil
        end

        return { file_path = path }
      end

      opts.integrations = {
        require('diagram.integrations.markdown'),
        require('diagram_mermaid_integration'),
      }

      require('diagram').setup(opts)

      vim.api.nvim_create_user_command('DiagramCheck', function()
        local image_ok = pcall(function() return require('image') end)
        local info = {
          '=== Diagram.nvim Debug Info ===',
          'mmdc executable: ' .. (vim.fn.executable('mmdc') == 1 and 'YES' or 'NO'),
          'image.nvim loaded: ' .. (image_ok and 'YES' or 'NO'),
          'TERM: ' .. (vim.env.TERM or 'not set'),
          'TERM_PROGRAM: ' .. (vim.env.TERM_PROGRAM or 'not set'),
          'WEZTERM_UNIX_SOCKET: ' .. (vim.env.WEZTERM_UNIX_SOCKET or 'not set'),
          'TMUX: ' .. (vim.env.TMUX ~= nil and 'YES' or 'NO'),
          'KITTY_WINDOW_ID: ' .. (vim.env.KITTY_WINDOW_ID or 'not set'),
          'PATH: ' .. vim.env.PATH,
          'cache_dir: ' .. cache_dir,
          'cache_dir exists: ' .. (vim.fn.isdirectory(cache_dir) == 1 and 'YES' or 'NO'),
        }
        if vim.fn.isdirectory(cache_dir) == 1 then
          local files = vim.fn.glob(cache_dir .. '/*', false, true)
          info[#info + 1] = 'cached images: ' .. #files
          for _, f in ipairs(files) do
            local size = vim.fn.getfsize(f)
            info[#info + 1] = '  - ' .. vim.fn.fnamemodify(f, ':t') .. ' (' .. size .. ' bytes)'
          end
        end
        print(table.concat(info, '\n'))
      end, { desc = 'Show diagram.nvim debug information' })

      -- Command to manually clear all diagram images
      vim.api.nvim_create_user_command('DiagramClear', function()
        if image_ok then
          require('image').clear()
          print('Cleared all images')
        end
      end, { desc = 'Clear all diagram images' })

      -- Command to open latest cached diagram image externally
      vim.api.nvim_create_user_command('DiagramOpen', function()
        local files = vim.fn.glob(cache_dir .. '/*.png', false, true)
        if #files == 0 then
          vim.notify('No cached diagrams found. Render one first with <leader>dr', vim.log.levels.WARN, { title = 'diagram.nvim' })
          return
        end
        local latest = files[#files]
        vim.fn.jobstart({ 'xdg-open', latest }, { detach = true })
        print('Opened: ' .. latest)
      end, { desc = 'Open latest cached diagram image' })

      -- Wrap hover to catch errors and fall back gracefully
      local original_hover = require('diagram').show_diagram_hover
      require('diagram').show_diagram_hover = function(...)
        local ok, err = pcall(original_hover, ...)
        if not ok then
          local err_msg = tostring(err)
          -- If it's a screenpos/line number error, offer to open image externally
          if err_msg:find('Invalid line number') or err_msg:find('screenpos') then
            local cache_files = vim.fn.glob(cache_dir .. '/*.png', false, true)
            if #cache_files > 0 then
              local latest = cache_files[#cache_files]
              vim.fn.jobstart({ 'xdg-open', latest }, { detach = true })
              vim.notify('Opened diagram in external viewer: ' .. latest, vim.log.levels.INFO, { title = 'diagram.nvim' })
            else
              vim.notify('No cached diagram. Use <leader>dr to render first.', vim.log.levels.WARN, { title = 'diagram.nvim' })
            end
          else
            vim.notify('diagram.nvim error: ' .. err_msg, vim.log.levels.ERROR, { title = 'diagram.nvim' })
          end
        end
      end
    end,
  },
}

-- vim: ts=2 sts=2 sw=2 et
