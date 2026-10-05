package main

import (
	"reflect"
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
