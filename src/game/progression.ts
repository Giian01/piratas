export const EXPERIENCE = Object.freeze({
  dropChance: 1 / 5,
  value: 1,
  baseRequirement: 3,
  growth: 1.5,
  pickupRange: 24,
  pickupDelay: 0.25,
});

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
}

/** Placeholders until the actual upgrades are defined. They grant no stats. */
export const LEVEL_UP_OPTIONS: readonly UpgradeOption[] = Object.freeze([
  { id: 'option-1', title: 'Opción 1', description: 'Mejora por definir' },
  { id: 'option-2', title: 'Opción 2', description: 'Mejora por definir' },
  { id: 'option-3', title: 'Opción 3', description: 'Mejora por definir' },
]);

export class Progression {
  level = 1;
  xp = 0;
  pendingLevels: number[] = [];
  selections: { level: number; optionId: string }[] = [];

  get requiredXp() {
    return Math.ceil(EXPERIENCE.baseRequirement * EXPERIENCE.growth ** (this.level - 1));
  }

  get needsChoice() {
    return this.pendingLevels.length > 0;
  }

  get options(): readonly UpgradeOption[] {
    return this.needsChoice ? LEVEL_UP_OPTIONS : [];
  }

  addExperience(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    this.xp += amount;
    while (this.xp >= this.requiredXp) {
      this.xp -= this.requiredXp;
      this.level++;
      this.pendingLevels.push(this.level);
    }
  }

  chooseOption(optionId: string, expectedLevel: number) {
    if (!this.needsChoice || this.pendingLevels[0] !== expectedLevel) return false;
    if (!LEVEL_UP_OPTIONS.some(option => option.id === optionId)) return false;
    this.selections.push({ level: expectedLevel, optionId });
    this.pendingLevels.shift();
    return true;
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = [];
    this.selections = [];
  }
}
