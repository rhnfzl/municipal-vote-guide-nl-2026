#!/bin/bash
# Run party explanation translation with logging
# Output goes to scripts/translate-explanations.log

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
LOG="$SCRIPT_DIR/translate-explanations.log"

echo "Starting translation at $(date)" | tee "$LOG"
echo "Model: ${1:-gpt-4.1-mini} | Concurrency: ${2:-8}" | tee -a "$LOG"
echo "Log: $LOG" | tee -a "$LOG"
echo "---" >> "$LOG"

node "$SCRIPT_DIR/translate-explanations.mjs" \
  --model "${1:-gpt-4.1-mini}" \
  --concurrency "${2:-8}" \
  2>&1 | tee -a "$LOG"

echo "" >> "$LOG"
echo "Finished at $(date)" | tee -a "$LOG"
