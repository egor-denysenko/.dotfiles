// Immediate DJI dictation toggle for Linux Sway sessions; never submits text.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"time"
)

func actionForState(state string) []string {
	if state == "idle" || state == "recording" {
		return []string{"/usr/bin/voxtype", "record", "toggle"}
	}
	return nil
}

func runCommand(args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Stderr = os.Stderr
	return cmd.Output()
}

func performAction() error {
	data, err := runCommand("/usr/bin/voxtype", "status", "--format", "json")
	if err != nil {
		return err
	}
	var status struct {
		Alt string `json:"alt"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		return err
	}
	if args := actionForState(status.Alt); args != nil {
		_, err = runCommand(args...)
	}
	return err
}

func main() {
	if os.Getenv("SWAYSOCK") == "" || os.Getenv("WAYLAND_DISPLAY") == "" {
		return
	}
	if err := performAction(); err != nil {
		fmt.Fprintln(os.Stderr, "dji-dictation:", err)
		os.Exit(1)
	}
}
