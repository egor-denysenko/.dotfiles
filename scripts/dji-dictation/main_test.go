package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"strings"
	"syscall"
	"testing"
)

func TestActionForState(t *testing.T) {
	for _, state := range []string{"idle", "recording", "transcribing", "stopped", "unknown", ""} {
		var want []string
		if state == "idle" || state == "recording" {
			want = []string{"/usr/bin/voxtype", "record", "toggle"}
		}
		if got := actionForState(state); !reflect.DeepEqual(got, want) {
			t.Fatalf("state=%q: got %v, want %v", state, got, want)
		}
	}
}

func TestParseState(t *testing.T) {
	for _, data := range []string{`{}`, `{"alt":"stopped"}`, `{"alt":"unknown"}`, `not json`} {
		if _, err := parseState([]byte(data)); err == nil {
			t.Errorf("accepted %s", data)
		}
	}
	for _, state := range []string{"idle", "recording", "transcribing"} {
		got, err := parseState([]byte(fmt.Sprintf(`{"alt":%q}`, state)))
		if err != nil || got != state {
			t.Fatalf("%s: %s, %v", state, got, err)
		}
	}
}

func TestPerformAction(t *testing.T) {
	for _, state := range []string{"idle", "recording", "transcribing"} {
		calls := 0
		err := performActionWith(func(args ...string) ([]byte, error) {
			calls++
			if calls == 1 {
				return []byte(fmt.Sprintf(`{"alt":%q}`, state)), nil
			}
			if !reflect.DeepEqual(args, actionForState(state)) {
				t.Fatalf("unexpected command %v", args)
			}
			return nil, nil
		})
		want := 2
		if state == "transcribing" {
			want = 1
		}
		if err != nil || calls != want {
			t.Fatalf("%s: calls=%d err=%v", state, calls, err)
		}
	}
	if err := performActionWith(func(...string) ([]byte, error) { return nil, fmt.Errorf("offline") }); err == nil {
		t.Fatal("lost command failure")
	}
}

func TestSessionAndConcurrentInvocation(t *testing.T) {
	t.Setenv("SWAYSOCK", "")
	if err := run(); err == nil {
		t.Fatal("missing session was silent")
	}
	t.Setenv("SWAYSOCK", "test")
	t.Setenv("WAYLAND_DISPLAY", "test")
	t.Setenv("XDG_RUNTIME_DIR", t.TempDir())
	old := os.Args
	os.Args = []string{"dji-dictation"}
	defer func() { os.Args = old }()
	lock, err := os.OpenFile(filepath.Join(os.Getenv("XDG_RUNTIME_DIR"), "dji-dictation.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	if err := run(); err != nil {
		t.Fatalf("concurrent invocation: %v", err)
	}
}

func TestRenderedReceiverBindings(t *testing.T) {
	out, err := exec.Command("chezmoi", "execute-template", "--override-data", `{"dji_dictation":true}`, "--file", "../../dot_config/sway/config.d/62-bindings-dji-dictation.conf.tmpl").CombinedOutput()
	if err != nil {
		t.Fatalf("render: %v: %s", err, out)
	}
	for _, product := range []string{"16661", "16405"} {
		id := "11427:" + product + ":DJI_Technology_Co.,_Ltd._Wireless_Mic_Rx_Consumer_Control"
		if !supportedReceiver(id) || strings.Count(string(out), id) != 2 {
			t.Errorf("missing remap/binding for %s: %s", id, out)
		}
	}
	if supportedReceiver("11427:999:DJI_Consumer_Control") {
		t.Fatal("accepted unknown receiver")
	}
}

func TestRepeatedClicksNeverSubmit(t *testing.T) {
	// Successive clicks may toggle recording but must never type Enter.
	for _, state := range []string{"idle", "recording", "transcribing", "idle"} {
		for _, arg := range actionForState(state) {
			if arg == "/usr/bin/wtype" || arg == "Return" {
				t.Fatal("dictation button must never submit text")
			}
		}
	}
}
