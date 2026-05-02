#!/bin/bash
# chezmoi run_once wrapper — delegates to the actual setup script inside dot_config/pi/agent/
# All skill configuration lives in dot_config/pi/agent/executable_setup_skills.sh
set -euo pipefail

"$HOME/.config/pi/agent/setup_skills.sh"
