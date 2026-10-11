// voxtype-spinner filters the official `voxtype status --follow --format json
// --extended` stream for waybar's custom/voxtype module.
//
// Each status line is rewritten to:
//   - show the pinned language as an emoji (water pistol for en, pizza for
//     it, globe for auto-detect) instead of the static microphone glyph;
//   - animate braille frames only while transcription runs;
//   - append the pinned language and the key/click bindings to the tooltip.
//
// The pinned language is read from the same TOML file the daemon loads
// (~/.config/voxtype/config.toml), so no subprocess is spawned per update.
package main

import (
	"bufio"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	frames    = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
	emojiEN   = "\U0001F52B" // water pistol — English
	emojiIT   = "\U0001F355" // pizza — Italian
	emojiAuto = "\U0001F30D" // globe — auto-detect
)

// configPath mirrors voxtype's XDG lookup for its config file.
func configPath() string {
	base := os.Getenv("XDG_CONFIG_HOME")
	if base == "" {
		base = filepath.Join(os.Getenv("HOME"), ".config")
	}
	return filepath.Join(base, "voxtype", "config.toml")
}

// parseLanguage extracts whisper.language from a TOML document. Voxtype
// accepts a string ("en") or a constrained array (["en", "it"]); arrays are
// joined with commas. Commented-out lines and other sections are ignored.
func parseLanguage(toml string) string {
	section := ""
	for _, line := range strings.Split(toml, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") {
			section = strings.Trim(line, "[]")
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok || section != "whisper" || strings.TrimSpace(key) != "language" {
			continue
		}
		if i := strings.IndexByte(value, '#'); i >= 0 {
			value = value[:i] // drop a trailing comment
		}
		return normalizeLanguage(strings.TrimSpace(value))
	}
	return ""
}

func normalizeLanguage(value string) string {
	value = strings.TrimSpace(value)
	if !strings.HasPrefix(value, "[") {
		return strings.Trim(value, `"'`)
	}
	var codes []string
	for _, part := range strings.Split(strings.Trim(value, "[]"), ",") {
		if code := strings.Trim(strings.TrimSpace(part), `"'`); code != "" {
			codes = append(codes, code)
		}
	}
	return strings.Join(codes, ",")
}

// languageState maps a raw config value to a CSS class and a tooltip label.
func languageState(raw string) (class, label string) {
	switch {
	case raw == "" || raw == "auto":
		return "lang-auto", "AUTO (detects en/it/others)"
	case strings.Contains(raw, ","):
		return "lang-auto", "AUTO (" + raw + ")"
	case raw == "en":
		return "lang-en", "EN (English)"
	case raw == "it":
		return "lang-it", "IT (Italiano)"
	default:
		return "lang-auto", "AUTO (" + raw + ")"
	}
}

func languageEmoji(class string) string {
	switch class {
	case "lang-en":
		return emojiEN
	case "lang-it":
		return emojiIT
	default:
		return emojiAuto
	}
}

var spinnerFrames = [...]string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

func frameText(frame int) string {
	return spinnerFrames[frame%len(spinnerFrames)]
}

// currentLanguage reads whisper.language from the daemon's config file.
func currentLanguage(path string) (class, label string) {
	raw := ""
	if data, err := os.ReadFile(path); err == nil {
		raw = parseLanguage(string(data))
	}
	return languageState(raw)
}

// statusClasses normalizes the daemon's class field, which may be a string
// or an array, into a slice.
func appendStatusClasses(dst []string, status map[string]any) []string {
	switch class := status["class"].(type) {
	case string:
		return append(dst, class)
	case []any:
		for _, item := range class {
			if s, ok := item.(string); ok {
				dst = append(dst, s)
			}
		}
		return dst
	default:
		if state, ok := status["alt"].(string); ok && state != "" {
			return append(dst, state)
		}
		return dst
	}
}

func statusClasses(status map[string]any) []string {
	return appendStatusClasses(nil, status)
}

// formatStatus rewrites one status line for waybar.
func formatStatus(status map[string]any, frame int, langClass, langLabel string) map[string]any {
	capacity := len(status)
	for _, key := range [...]string{"text", "class", "tooltip"} {
		if _, exists := status[key]; !exists {
			capacity++
		}
	}
	result := make(map[string]any, capacity)
	for key, value := range status {
		result[key] = value
	}
	if state, _ := status["alt"].(string); state == "transcribing" {
		result["text"] = frameText(frame)
	} else {
		result["text"] = languageEmoji(langClass)
	}
	classes := appendStatusClasses(make([]string, 0, len(status)+1), status)
	filtered := classes[:0]
	for _, class := range classes {
		if !strings.HasPrefix(class, "lang-") {
			filtered = append(filtered, class)
		}
	}
	result["class"] = append(filtered, langClass)
	tooltip, _ := status["tooltip"].(string)
	result["tooltip"] = tooltip +
		"\nLanguage: " + langLabel +
		"\nShortcut: Super+Shift+V" +
		"\nClick: cycle language (en > it > auto)"
	return result
}

type statusEmitter struct {
	encoder *jsontext.Encoder
}

func newStatusEmitter(w io.Writer) *statusEmitter {
	return &statusEmitter{encoder: jsontext.NewEncoder(w)}
}

func (e *statusEmitter) emit(status map[string]any) {
	_ = json.MarshalEncode(e.encoder, status)
}

func main() {
	config := configPath()
	output := newStatusEmitter(os.Stdout)
	lines := make(chan string)
	go func() {
		defer close(lines)
		scanner := bufio.NewScanner(os.Stdin)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
	}()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	// Re-read the config on every incoming status line; switching language
	// restarts the daemon, which ends this stream anyway.
	langClass, langLabel := currentLanguage(config)
	var last map[string]any
	var frame int
	spinning := false

	for {
		select {
		case line, ok := <-lines:
			if !ok {
				return
			}
			if strings.TrimSpace(line) == "" {
				continue
			}
			var status map[string]any
			if err := json.Unmarshal([]byte(line), &status); err != nil {
				continue
			}
			frame = 0
			state, _ := status["alt"].(string)
			spinning = state == "transcribing"
			langClass, langLabel = currentLanguage(config)
			last = formatStatus(status, frame, langClass, langLabel)
			output.emit(last)
		case <-ticker.C:
			if spinning && last != nil {
				frame++
				last["text"] = frameText(frame)
				output.emit(last)
			}
		}
	}
}
