import Phaser from 'phaser';
import { ArenaScene } from './game/ArenaScene.ts';
import type { ArenaStatus } from './game/ArenaScene.ts';
import { SABRE } from './game/combat.ts';
import './style.css';

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#17363c',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, ArenaScene],
});

const mainMenu = document.querySelector<HTMLElement>('#main-menu')!;
const quickGame = document.querySelector<HTMLElement>('#quick-game')!;
const quickStartButton = document.querySelector<HTMLButtonElement>('#quick-start')!;
const backButton = document.querySelector<HTMLButtonElement>('#back-to-menu')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause-game')!;
const restartButton = document.querySelector<HTMLButtonElement>('#restart-game')!;
const resumeButton = document.querySelector<HTMLButtonElement>('#resume-game')!;
const playOverlay = document.querySelector<HTMLElement>('#play-overlay')!;
const overlayTitle = document.querySelector<HTMLElement>('#overlay-title')!;
const overlayDetail = document.querySelector<HTMLElement>('#overlay-detail')!;
const hpLabel = document.querySelector<HTMLElement>('#hp-label')!;
const hpBar = document.querySelector<HTMLMeterElement>('#hp-bar')!;
const killLabel = document.querySelector<HTMLElement>('#kill-count')!;
const goldLabel = document.querySelector<HTMLOutputElement>('#gold-count')!;
const levelLabel = document.querySelector<HTMLElement>('#player-level')!;
const xpLabel = document.querySelector<HTMLElement>('#xp-label')!;
const xpBar = document.querySelector<HTMLProgressElement>('#xp-bar')!;
const levelDialog = document.querySelector<HTMLDialogElement>('#level-up-dialog')!;
const levelDialogTitle = document.querySelector<HTMLElement>('#level-up-title')!;
const levelOptions = document.querySelector<HTMLElement>('#level-up-options')!;
const timeLabel = document.querySelector<HTMLElement>('#run-time')!;
const cooldown = document.querySelector<HTMLProgressElement>('#attack-cooldown')!;
const attackState = document.querySelector<HTMLElement>('#attack-state')!;
let inGame = false;
let shownChoiceLevel: number | null = null;

function focusGame() {
  if (game.canvas) {
    game.canvas.tabIndex = 0;
    game.canvas.focus({ preventScroll: true });
  }
}

function closeLevelDialog() {
  if (levelDialog.open) levelDialog.close();
  shownChoiceLevel = null;
}

function updateLevelDialog(status: ArenaStatus) {
  if (status.dead || status.choiceLevel === null) {
    closeLevelDialog();
    return;
  }
  const choiceLevel = status.choiceLevel;
  if (shownChoiceLevel !== choiceLevel) {
    levelDialogTitle.textContent = `Nivel ${choiceLevel}`;
    const buttons = status.options.map((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'level-option';
      const number = document.createElement('span');
      number.className = 'option-number';
      number.textContent = `0${index + 1}`;
      const title = document.createElement('strong');
      title.textContent = option.title;
      const description = document.createElement('span');
      description.textContent = option.description;
      button.append(number, title, description);
      button.onkeydown = event => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      };
      button.onclick = () => {
        const accepted = (game.scene.getScene('ArenaScene') as ArenaScene).chooseUpgrade(option.id, choiceLevel);
        if (accepted && !levelDialog.open) {
          if (playOverlay.hidden) focusGame();
          else resumeButton.focus();
        }
      };
      return button;
    });
    levelOptions.replaceChildren(...buttons);
    shownChoiceLevel = choiceLevel;
    if (levelDialog.open) buttons[0]?.focus({ preventScroll: true });
  }
  if (!levelDialog.open) levelDialog.showModal();
}

levelDialog.oncancel = event => event.preventDefault();

function updateStatus(status: ArenaStatus) {
  if (!inGame) return;
  hpLabel.textContent = `${status.hp} / ${status.maxHp}`;
  hpBar.value = status.hp;
  hpBar.max = status.maxHp;
  killLabel.textContent = `${status.kills}`;
  if (goldLabel.textContent !== `${status.gold}`) goldLabel.textContent = `${status.gold}`;
  levelLabel.textContent = `${status.level}`;
  xpLabel.textContent = `${status.xp} / ${status.requiredXp} EXP`;
  xpBar.max = status.requiredXp;
  xpBar.value = status.xp;
  const seconds = Math.floor(status.elapsed);
  timeLabel.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  cooldown.value = 1 - status.cooldown / SABRE.cooldown;
  attackState.textContent = status.cooldown > 0 ? 'Preparando golpe' : 'Listo · busca un enemigo';
  playOverlay.hidden = status.choiceLevel !== null || (!status.paused && !status.dead);
  pauseButton.textContent = status.paused ? 'Continuar' : 'Pausa';
  pauseButton.disabled = status.dead || status.choiceLevel !== null;
  if (!playOverlay.hidden) {
    overlayTitle.textContent = status.dead ? 'Fin de la partida' : 'En pausa';
    overlayDetail.textContent = status.dead ? `${status.kills} bajas · ${status.gold} oro · ${timeLabel.textContent}` : 'El combate está detenido.';
    resumeButton.hidden = status.dead;
  }
  updateLevelDialog(status);
}

game.events.on('arena-status', updateStatus);

quickStartButton.onclick = () => {
  mainMenu.hidden = true;
  quickGame.hidden = false;
  inGame = true;
  closeLevelDialog();
  playOverlay.hidden = true;
  game.scene.start('ArenaScene');
  focusGame();
};

backButton.onclick = () => {
  inGame = false;
  closeLevelDialog();
  game.scene.stop('ArenaScene');
  quickGame.hidden = true;
  mainMenu.hidden = false;
  quickStartButton.focus();
};

pauseButton.onclick = resumeButton.onclick = () => {
  (game.scene.getScene('ArenaScene') as ArenaScene).togglePause();
  focusGame();
};

restartButton.onclick = () => {
  closeLevelDialog();
  playOverlay.hidden = true;
  game.scene.stop('ArenaScene');
  game.scene.start('ArenaScene');
  focusGame();
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    quickStartButton.onclick = null;
    backButton.onclick = null;
    pauseButton.onclick = null;
    resumeButton.onclick = null;
    restartButton.onclick = null;
    levelDialog.oncancel = null;
    closeLevelDialog();
    levelOptions.replaceChildren();
    game.events.off('arena-status', updateStatus);
    game.destroy(true);
  });
}
