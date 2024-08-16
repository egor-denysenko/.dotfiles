#!/bin/bash -ex

go install golang.org/dl/gotip@latest
go install golang.org/x/tools/cmd/godoc@latest
go install github.com/lotusirous/gostdsym/stdsym@latest
go install github.com/go-delve/delve/cmd/dlv@latest
go install golang.org/x/tools/gopls@latest
go install mvdan.cc/gofumpt@latest
go install golang.org/x/tools/cmd/deadcode@latest
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install github.com/segmentio/golines@latest
go install github.com/goccy/go-graphviz@latest
go install github.com/dkorunic/betteralign/cmd/betteralign@latest
go install github.com/oligot/go-mod-upgrade@latest
