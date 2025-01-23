-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This table will hold the configuration.
local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
	config = wezterm.config_builder()
end

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
config.color_scheme = "Liquid Carbon Transparent (Gogh)"

-- Remove tab bar in order to gain more space
config.enable_tab_bar = false

-- Spawn a zsh on wezterm start
config.default_prog = { "/usr/bin/zsh" }

-- Set DepartureMono as terminal default font
-- config.font = wezterm.font("DepartureMono-Regular", {
-- 	weight = "Regular",
-- 	italic = true,
-- })
-- config.font_size = 11.0

-- and finally, return the configuration to wezterm
return config
