// Every global hotkey lives in this one listener, behind one input-field guard
// (F2 used to hijack typing in inputs — the recorder listener had no guard).
// The player-facing list is the help overlay (hud.buildHelp); keep them in sync.

import { MatchRecorder } from './recorder.js';

export function installHotkeys({ controls, hud, recorder }) {
  const actions = {
    Escape: () => controls.cancelOrDeselect(),
    KeyF: () => controls.armAttackMove(), // "fight-move"; A stays camera-pan like WASD
    KeyX: () => controls.stopSelection(), // S belongs to camera pan — the old double-binding
    Period: () => controls.cycleIdleWorker(), //   halted armies while players scrolled
    KeyP: () => controls.onOrder({ type: 'pause' }),
    KeyE: () => controls.selectSoldiersOnScreen(),
    F1: e => { e.preventDefault(); hud.toggleHelp(); },
    KeyM: () => hud.toggleMute(),
    KeyH: () => hud.jumpHome(), // home: jump to capital (C&C style)
    Space: e => { e.preventDefault(); hud.jumpToLastAlert(); },
    F2: e => { // save match log · Shift+F2 recovers the localStorage backup
      e.preventDefault();
      if (e.shiftKey) MatchRecorder.downloadBackup();
      else recorder.download();
    },
  };
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    // control groups: Ctrl+1..9 assign, 1..9 recall, double-tap centers
    const group = e.code.match(/^Digit([1-9])$/);
    if (group) {
      e.preventDefault();
      controls.groupKey(group[1], e.ctrlKey || e.metaKey);
      return;
    }
    actions[e.code]?.(e);
  });
}
