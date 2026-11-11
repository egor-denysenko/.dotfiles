// Immediate DJI dictation toggle for Linux Sway sessions; never submits text.
package main

import (
	"context"
	"encoding/json/v2"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
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

func parseState(data []byte) (string, error) {
	var status struct {
		Alt string `json:"alt"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		return "", fmt.Errorf("parse voxtype status: %w", err)
	}
	switch status.Alt {
	case "idle", "recording", "transcribing":
		return status.Alt, nil
	default:
		return "", fmt.Errorf("unexpected voxtype state %q", status.Alt)
	}
}

func performActionWith(run func(...string) ([]byte, error)) error {
	data, err := run("/usr/bin/voxtype", "status", "--format", "json")
	if err != nil {
		return err
	}
	state, err := parseState(data)
	if err != nil {
		return err
	}
	if args := actionForState(state); args != nil {
		_, err = run(args...)
	}
	return err
}

func supportedReceiver(id string) bool {
	for _, product := range []string{"16661", "16405"} {
		if id == "11427:"+product+":DJI_Technology_Co.,_Ltd._Wireless_Mic_Rx_Consumer_Control" {
			return true
		}
	}
	return false
}

func doctor() error {
	for _, binary := range []string{"/usr/bin/voxtype", "swaymsg"} {
		if _, err := exec.LookPath(binary); err != nil {
			return err
		}
	}
	data, err := runCommand("swaymsg", "-r", "-t", "get_inputs")
	if err != nil {
		return fmt.Errorf("query Sway inputs: %w", err)
	}
	var inputs []struct {
		Identifier string   `json:"identifier"`
		Layouts    []string `json:"xkb_layout_names"`
	}
	if err := json.Unmarshal(data, &inputs); err != nil {
		return err
	}
	found := false
	for _, input := range inputs {
		if !strings.HasPrefix(input.Identifier, "11427:") || !strings.HasSuffix(input.Identifier, "_Consumer_Control") {
			continue
		}
		fmt.Println("Receiver:", input.Identifier)
		if !supportedReceiver(input.Identifier) {
			return fmt.Errorf("unsupported receiver %s: add its identifier to the Sway configuration", input.Identifier)
		}
		found = true
		// The dedicated map uses pc+us+inet(evdev), unlike the normal keyboard map.
		if len(input.Layouts) != 1 || input.Layouts[0] != "English (US)" {
			return fmt.Errorf("receiver keymap is %v, expected dedicated English (US) map; apply configuration and reload Sway", input.Layouts)
		}
	}
	if !found {
		return fmt.Errorf("no DJI Consumer Control receiver found in Sway")
	}
	mapData, err := os.ReadFile(filepath.Join(os.Getenv("HOME"), ".config/sway/keybinds/dji-dictation.xkb"))
	if err != nil {
		return err
	}
	if !strings.Contains(string(mapData), "replace key <VOL+> { [ F20 ] };") {
		return fmt.Errorf("DJI keymap is missing the volume-up to F20 remap")
	}
	data, err = runCommand("/usr/bin/voxtype", "status", "--format", "json")
	if err != nil {
		return fmt.Errorf("query voxtype: %w", err)
	}
	state, err := parseState(data)
	if err != nil {
		return err
	}
	fmt.Println("Voxtype:", state)
	fmt.Println("OK: receiver and keymap checks passed (press the button to verify end-to-end).")
	return nil
}

func run() error {
	if os.Getenv("SWAYSOCK") == "" || os.Getenv("WAYLAND_DISPLAY") == "" {
		return fmt.Errorf("requires a Sway Wayland session (SWAYSOCK and WAYLAND_DISPLAY)")
	}
	if len(os.Args) == 2 && os.Args[1] == "doctor" {
		return doctor()
	}
	if len(os.Args) != 1 {
		return fmt.Errorf("usage: dji-dictation [doctor]")
	}
	dir := os.Getenv("XDG_RUNTIME_DIR")
	if dir == "" {
		return fmt.Errorf("XDG_RUNTIME_DIR is not set")
	}
	lock, err := os.OpenFile(filepath.Join(dir, "dji-dictation.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		if err == syscall.EWOULDBLOCK {
			return nil
		}
		return err
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	return performActionWith(runCommand)
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "dji-dictation:", err)
		os.Exit(1)
	}
}
