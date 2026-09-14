Use edit over write.
Test after changes.

Optional private defaults belong in `~/.config/chezmoi/chezmoi.toml` as
`pi_private_default_provider` and `pi_private_default_model`; the template
falls back to `llmgateway` and `free-auto` when they are absent.
