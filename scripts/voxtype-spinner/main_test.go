package main

import (
	"encoding/json/v2"
	"strings"
	"testing"
)

func TestParseLanguage(t *testing.T) {
	tests := []struct{ name, toml, want string }{
		{"string", "[whisper]\nlanguage = \"en\"\n", "en"},
		{"single quotes", "[whisper]\nlanguage = 'it'\n", "it"},
		{"constrained array", "[whisper]\nlanguage = [\"en\", \"it\"]\n", "en,it"},
		{"auto", "[whisper]\nlanguage = \"auto\"\n", "auto"},
		{"commented out", "[whisper]\n# language = \"en\"\n", ""},
		{"other section only", "[output]\nlanguage = \"x\"\n[whisper]\nmodel = \"small\"\n", ""},
		{"trailing comment", "[whisper]\nlanguage = \"it\" # pinned\n", "it"},
		{"missing key", "[whisper]\nmodel = \"small\"\n", ""},
		{"empty document", "", ""},
	}
	for _, tt := range tests {
		if got := parseLanguage(tt.toml); got != tt.want {
			t.Errorf("%s: parseLanguage() = %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestLanguageState(t *testing.T) {
	tests := []struct{ raw, class, label string }{
		{"en", "lang-en", "EN (English)"},
		{"it", "lang-it", "IT (Italiano)"},
		{"auto", "lang-auto", "AUTO (detects en/it/others)"},
		{"", "lang-auto", "AUTO (detects en/it/others)"},
		{"en,it", "lang-auto", "AUTO (en,it)"},
		{"az", "lang-auto", "AUTO (az)"},
	}
	for _, tt := range tests {
		class, label := languageState(tt.raw)
		if class != tt.class || label != tt.label {
			t.Errorf("languageState(%q) = (%q, %q), want (%q, %q)", tt.raw, class, label, tt.class, tt.label)
		}
	}
}

func TestLanguageEmoji(t *testing.T) {
	tests := []struct{ class, want string }{
		{"lang-en", emojiEN},
		{"lang-it", emojiIT},
		{"lang-auto", emojiAuto},
		{"unknown", emojiAuto},
	}
	for _, tt := range tests {
		if got := languageEmoji(tt.class); got != tt.want {
			t.Errorf("languageEmoji(%q) = %q, want %q", tt.class, got, tt.want)
		}
	}
}

func TestFrameTextCycles(t *testing.T) {
	runes := []rune(frames)
	for i := range runes {
		if got := frameText(i); got != string(runes[i]) {
			t.Fatalf("frameText(%d) = %q, want %q", i, got, string(runes[i]))
		}
	}
	if got := frameText(len(runes)); got != string(runes[0]) {
		t.Fatalf("frameText must wrap: got %q, want %q", got, string(runes[0]))
	}
}

func TestFormatStatusIdleShowsLanguageEmoji(t *testing.T) {
	status := map[string]any{"alt": "idle", "class": "idle", "text": "x", "tooltip": "Voxtype ready"}
	out := formatStatus(status, 0, "lang-it", "IT (Italiano)")

	if out["text"] != emojiIT {
		t.Errorf("text = %q, want %q", out["text"], emojiIT)
	}
	classes, ok := out["class"].([]string)
	if !ok || len(classes) != 2 || classes[0] != "idle" || classes[1] != "lang-it" {
		t.Errorf("class = %#v, want [idle lang-it]", out["class"])
	}
	if !strings.Contains(out["tooltip"].(string), "Language: IT (Italiano)") {
		t.Errorf("tooltip missing language label: %q", out["tooltip"])
	}
	if !strings.Contains(out["tooltip"].(string), "Click: cycle language") {
		t.Errorf("tooltip missing click hint: %q", out["tooltip"])
	}
}

func TestFormatStatusReplacesStaleLanguageClass(t *testing.T) {
	status := map[string]any{"alt": "stopped", "class": []any{"stopped", "lang-en"}}
	out := formatStatus(status, 0, "lang-en", "EN (English)")

	classes, ok := out["class"].([]string)
	if !ok || len(classes) != 2 || classes[0] != "stopped" || classes[1] != "lang-en" {
		t.Fatalf("class = %#v, want [stopped lang-en]", out["class"])
	}
}

func TestFormatStatusTranscribingAnimates(t *testing.T) {
	status := map[string]any{"alt": "transcribing", "class": "transcribing"}
	out := formatStatus(status, 3, "lang-auto", "AUTO (detects en/it/others)")

	if out["text"] != frameText(3) {
		t.Errorf("text = %q, want frame %q", out["text"], frameText(3))
	}
	if out["text"] == emojiAuto {
		t.Error("transcribing must animate, not show the language emoji")
	}
}

func TestFormatStatusKeepsDaemonFields(t *testing.T) {
	status := map[string]any{"alt": "recording", "model": "large-v3-turbo", "backend": "GPU (Vulkan)"}
	out := formatStatus(status, 0, "lang-en", "EN (English)")

	if out["model"] != "large-v3-turbo" || out["backend"] != "GPU (Vulkan)" {
		t.Errorf("daemon fields must survive: %#v", out)
	}
}

func TestStatusEmitterReusesEncoderAndTerminatesLines(t *testing.T) {
	var output strings.Builder
	emitter := newStatusEmitter(&output)
	emitter.emit(map[string]any{"alt": "idle"})
	emitter.emit(map[string]any{"alt": "recording"})

	lines := strings.Split(output.String(), "\n")
	if len(lines) != 3 || lines[2] != "" {
		t.Fatalf("output must contain two newline-terminated JSON records: %q", output.String())
	}
	for i, want := range []string{`"alt":"idle"`, `"alt":"recording"`} {
		if !strings.Contains(lines[i], want) {
			t.Errorf("line %d = %q, want it to contain %q", i, lines[i], want)
		}
	}
}

func TestEmojiSurvivesJSONMarshalling(t *testing.T) {
	status := map[string]any{"alt": "idle", "class": "idle"}
	line, err := json.Marshal(formatStatus(status, 0, "lang-en", "EN (English)"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(line), emojiEN) {
		t.Errorf("emoji must be emitted as UTF-8, got %s", line)
	}
}
