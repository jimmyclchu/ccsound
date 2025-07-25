# ccsound - Claude Code Audio Notifications

> A simple CLI tool to add audio notifications to Claude Code events

## Quick Start

```bash
# Interactive setup (recommended)
npx ccsound

# Add specific event
npx ccsound add-sound --event Stop --file ~/sounds/done.mp3

# Test your setup
npx ccsound test Stop
```

## Features

- Interactive setup with built-in sounds
- Support for all Claude Code hook events
- Smart duplicate detection and prevention
- Audio file validation and testing
- Watermarked hook management
- Comprehensive diagnostics

## Supported Events

- **Stop**: When Claude finishes responding
- **Notification**: When Claude needs user input
- **PreToolUse**: Before Claude runs any tool
- **PostToolUse**: After Claude runs any tool
- **SubagentStop**: When a subagent finishes

## Commands

### Interactive Setup
```bash
npx ccsound
```

### Add Sound Hook
```bash
npx ccsound add-sound --event Stop --file ~/sounds/done.mp3
npx ccsound add-sound --events Stop,Notification --file ~/sounds/alert.mp3
```

### Test Audio
```bash
npx ccsound test Stop      # Test specific event
npx ccsound test --all     # Test all events
```

### Manage Hooks
```bash
npx ccsound list           # List all hooks
npx ccsound remove Stop    # Remove hooks for event
npx ccsound clear          # Remove all ccsound hooks
```

### Presets
```bash
npx ccsound preset minimal     # Stop event only
npx ccsound preset complete    # All events
npx ccsound preset development # PreToolUse + PostToolUse + Stop
```

### Diagnostics
```bash
npx ccsound doctor         # Run comprehensive diagnostics
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev

# Test locally
npm link
ccsound --help
```

## Requirements

- Node.js 16+
- Claude Code (auto-installed if missing)

## Example Output

```
$ npx ccsound doctor
ccsound diagnostics

Claude Code: v1.0.57 installed
Settings file: ~/.claude/settings.json (writable)
Audio system: afplay available
ccsound hooks: 2 configured, 2 valid

Managed hooks:
PASS Stop: /System/Library/Sounds/Ping.aiff (ccsound v1.0.0)
PASS Notification: /System/Library/Sounds/Glass.aiff (ccsound v1.0.0)
```

## Configuration

Audio hooks are stored in the global Claude Code settings file (`~/.claude/settings.json`) as user preferences. Local project settings (`.claude/settings.local.json`) are preserved for project-specific configurations like permissions.

## License

MIT