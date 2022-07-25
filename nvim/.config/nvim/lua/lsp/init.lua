-- Secure calling lspconfig plugin
local status_ok, _ = pcall(require, "lspconfig")
if not status_ok then
	return
end
-- requiring the file that is in charge of configuring lsp
require("lsp.lsp-installer")
require("lsp.handlers").setup()
