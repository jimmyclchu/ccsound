export type ClaudeCodeEvent = 'Stop' | 'Notification' | 'PreToolUse' | 'PostToolUse' | 'SubagentStop';

export interface ccsoundWatermark {
  version: string;
  managed: boolean;
  created: string;
  id: string;
  migrated?: boolean;
}

export interface Hook {
  type: 'command';
  command: string;
  _ccsound?: ccsoundWatermark;
}

export interface HookGroup {
  matchers?: string[];
  hooks: Hook[];
}

export interface SettingsConfig {
  hooks: {
    [key in ClaudeCodeEvent]?: HookGroup[];
  };
}

export interface AudioValidation {
  exists: boolean;
  path: string;
  error?: string;
}

export interface TestOptions {
  all?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  showCommand?: boolean;
  delay?: string;
  events?: ClaudeCodeEvent[];
}

export interface AddSoundOptions {
  matcher?: string;
}

export type PresetName = 'minimal' | 'complete' | 'development';

export interface DiagnosticResult {
  claudeCode: {
    installed: boolean;
    version: string | null;
  };
  settingsFile: {
    exists: boolean;
    path: string;
    writable: boolean;
  };
  audioSystem: {
    available: boolean;
    player: string | null;
  };
  hooks: {
    total: number;
    valid: number;
    invalid: Hook[];
  };
}