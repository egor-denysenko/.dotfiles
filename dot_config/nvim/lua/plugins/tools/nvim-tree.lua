return {
	{
		"nvim-tree/nvim-tree.lua",
		lazy = false,
		dependencies = {
			"nvim-tree/nvim-web-devicons",
		},
		config = function()
			-- Disable netrw entirely so nvim-tree takes over.
			vim.g.loaded_netrw = 1
			vim.g.loaded_netrwPlugin = 1

			require("nvim-tree").setup({
				hijack_cursor = true,
				hijack_netrw = true,
				hijack_directories = {
					enable = true,
				},
				view = {
					number = true,
					relativenumber = true,
					adaptive_size = true,
					width = {
						min = 30,
						max = 45,
					},
					side = "left",
				},
				filters = {
					custom = { "^.git$", ".DS_Store", "node_modules" },
					dotfiles = false,
					git_ignored = true,
				},
				git = {
					enable = true,
				},
				actions = {
					open_file = {
						resize_window = true,
						quit_on_open = true,
					},
					remove_file = {
						close_window = false,
					},
				},
				update_focused_file = {
					enable = true,
					update_root = {
						enable = true,
					},
				},
				diagnostics = {
					enable = false,
					show_on_dirs = false,
					debounce_delay = 50,
					icons = {
						hint = "",
						info = "",
						warning = "",
						error = "",
					},
				},
			})

			-- Auto-close NvimTree when it's the last remaining window.
			-- NOTE: We cannot call NvimTreeClose or nvim_win_close on the tree window
			-- inside QuitPre because NvimTree's internal WinClosed/BufUnload handlers
			-- cause a hang in that context. Instead, we bypass all autocmds with
			-- `noautocmd qall!` to cleanly exit.
			vim.api.nvim_create_autocmd("QuitPre", {
				callback = function()
					local wins = vim.api.nvim_list_wins()
					local tree_wins = 0
					local floating_wins = 0
					for _, w in ipairs(wins) do
						local ok, buf = pcall(vim.api.nvim_win_get_buf, w)
						if ok and vim.api.nvim_buf_is_valid(buf) then
							local bufname = vim.api.nvim_buf_get_name(buf)
							if bufname:match("NvimTree_") then
								tree_wins = tree_wins + 1
							end
							if vim.api.nvim_win_get_config(w).relative ~= "" then
								floating_wins = floating_wins + 1
							end
						end
					end
					-- If tree is open and only 0-1 real windows remain, quit everything
					if tree_wins > 0 and (#wins - floating_wins - tree_wins) <= 1 then
						pcall(vim.cmd, "noautocmd qall!")
					end
				end,
			})
		end,
	},
}
