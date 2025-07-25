export { 
  checkClaudeCodeInstallation,
  runAutoInstallation 
} from './installer';

export {
  addSoundHook,
  listHooks,
  removeHooks,
  clearAllHooks,
  applyPreset,
  createWatermark,
  isccsoundManaged,
  findExistingAudioHook,
  findExistingccsoundHooks
} from './hooks';

export {
  testSpecificEvent,
  testAllEvents
} from './test';

export {
  runDiagnostics,
  getAudioPlayer,
  validateAudioFile,
  delay
} from './utils';

export {
  readSettingsFile,
  writeSettingsFile,
  getSettingsPath,
  ensureHooksStructure,
  getEventHooks,
  setEventHooks
} from './config';

export * from '../types';