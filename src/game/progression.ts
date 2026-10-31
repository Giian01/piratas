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

export const UPGRADES = Object.freeze([
  { id: 'sharp-edge', title: 'Filo afilado', stat: 'damage', bonus: 0.20, limit: 5, label: 'del daño base' },
  { id: 'quick-hands', title: 'Manos rápidas', stat: 'frequency', bonus: 0.15, limit: 5, label: 'de la frecuencia de ataque base' },
  { id: 'boarding-boots', title: 'Botas de abordaje', stat: 'movement', bonus: 0.10, limit: 3, label: 'de la velocidad de movimiento base' },
] as const);

export class Progression {
  level = 1;
  xp = 0;
  pendingLevels: number[] = [];
  selections: { level: number; optionId: string }[] = [];

  stacks(optionId: string) {
    return this.selections.filter(selection => selection.optionId === optionId).length;
  }

  multiplier(stat: typeof UPGRADES[number]['stat']) {
    return 1 + UPGRADES.filter(upgrade => upgrade.stat === stat)
      .reduce((total, upgrade) => total + upgrade.bonus * this.stacks(upgrade.id), 0);
  }

  private get availableUpgrades() {
    return UPGRADES.filter(upgrade => this.stacks(upgrade.id) < upgrade.limit);
  }

  get requiredXp() {
    return Math.ceil(EXPERIENCE.baseRequirement * EXPERIENCE.growth ** (this.level - 1));
  }

  get needsChoice() {
    return this.pendingLevels.length > 0;
  }

  get options(): readonly UpgradeOption[] {
    return this.needsChoice ? this.availableUpgrades.map(upgrade => {
      const stacks = this.stacks(upgrade.id);
      const percent = (count: number) => Math.round(upgrade.bonus * count * 100);
      return {
        id: upgrade.id, title: upgrade.title,
        description: `+${percent(1)} % ${upgrade.label} por acumulación. ` +
          `Acumulaciones: ${stacks}/${upgrade.limit} → ${stacks + 1}/${upgrade.limit}. ` +
          `Bono total: +${percent(stacks)} % → +${percent(stacks + 1)} %.` +
          (upgrade.stat === 'frequency' ? ` Intervalo = intervalo base / ${(1 + upgrade.bonus * (stacks + 1)).toFixed(2)}.` : ''),
      };
    }) : [];
  }

  addExperience(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    this.xp += amount;
    while (this.xp >= this.requiredXp) {
      this.xp -= this.requiredXp;
      this.level++;
      if (this.availableUpgrades.length > 0) this.pendingLevels.push(this.level);
    }
  }

  chooseOption(optionId: string, expectedLevel: number) {
    if (!this.needsChoice || this.pendingLevels[0] !== expectedLevel) return false;
    if (!this.availableUpgrades.some(option => option.id === optionId)) return false;
    this.selections.push({ level: expectedLevel, optionId });
    this.pendingLevels.shift();
    // Queued levels still count, but cannot require a choice with no valid cards.
    if (this.availableUpgrades.length === 0) this.pendingLevels = [];
    return true;
  }

  reset() {
    this.level = 1;
    this.xp = 0;
    this.pendingLevels = [];
    this.selections = [];
  }
}
