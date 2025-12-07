/**
 * Sidebar Controls Module
 * サイドバーのUI制御（色・種類選択など）
 */

import {
  category,
  defaultFireworkColorKey,
  fireWorkCategory,
  fireworkColorPresets,
  params,
} from "../core/constant.js";

const randomColorKey = "random";

/**
 * 花火の色を解決
 */
export const resolveFireworkHex = (colorKeyOrHex) => {
  if (!colorKeyOrHex) {
    return undefined;
  }
  if (typeof colorKeyOrHex === "string" && colorKeyOrHex.startsWith("#")) {
    return colorKeyOrHex;
  }
  return fireworkColorPresets[colorKeyOrHex]?.hex;
};

/**
 * プリセットキーを解決
 */
export const resolveFireworkPresetKey = (colorKeyOrHex) => {
  if (!colorKeyOrHex) {
    return undefined;
  }
  const isHex =
    typeof colorKeyOrHex === "string" && colorKeyOrHex.startsWith("#");
  if (!isHex && fireworkColorPresets[colorKeyOrHex]) {
    return colorKeyOrHex;
  }
  const hexValue = isHex
    ? colorKeyOrHex
    : fireworkColorPresets[colorKeyOrHex]?.hex;
  if (typeof hexValue !== "string") {
    return undefined;
  }
  const normalizedHex = hexValue.toLowerCase();
  const match = Object.entries(fireworkColorPresets).find(
    ([, preset]) => preset.hex.toLowerCase() === normalizedHex
  );
  return match?.[0];
};

/**
 * セカンダリカラーのプリセットキーを取得
 */
export const resolveSecondaryPresetKey = (primaryKey) =>
  fireworkColorPresets[primaryKey]?.secondary ?? defaultFireworkColorKey;

/**
 * カテゴリ値からキーを解決
 */
export const resolveCategoryKeyFromValue = (value) => {
  const entry = Object.entries(fireWorkCategory).find(
    ([, label]) => label === value
  );
  return entry?.[0];
};

/**
 * サイドバーコントローラークラス
 */
export class SidebarController {
  constructor(options = {}) {
    this.fireworks = options.fireworks || [];
    this.onColorChange = options.onColorChange;
    this.onCategoryChange = options.onCategoryChange;
    this.onModeChange = options.onModeChange;
    this.onHeightChange = options.onHeightChange;

    // 状態
    this.activeFireworkColorKey = defaultFireworkColorKey;
    this.activeFireworkCategoryKey = resolveCategoryKeyFromValue(
      params.category
    );
    this.activeMode = "solo";
    this.activeBurstTypeKey = "renpatsu";

    // DOM要素
    this.fireworkColorButtons = [];
    this.fireworkCategoryCards = [];
    this.modeTabs = [];
    this.burstTypeCards = [];
    this.burstTypeSection = null;
    this.heightSlider = null;
    this.heightValue = null;
    this.sidebar = null;
    this.controlPanelContainer = null;
    this.randomColorButton = null;
    this.activeRandomResolvedKey = null;
  }

  /**
   * DOM要素を設定して初期化
   */
  initialize() {
    this._setupColorButtons();
    this._setupCategoryCards();
    this._setupModeTabs();
    this._setupBurstTypeCards();
    this._setupHeightSlider();
    this._setupSidebarToggle();
  }

  /**
   * 色ボタンのセットアップ
   */
  _setupColorButtons() {
    this.fireworkColorButtons = Array.from(
      document.querySelectorAll(".firework-color-swatch")
    );
    this.randomColorButton = document.querySelector(
      '.firework-color-swatch[data-firework-color="random"]'
    );

    this.fireworkColorButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const colorKey = button.dataset.fireworkColor;
        if (!colorKey || colorKey === this.activeFireworkColorKey) {
          return;
        }
        this.setFireworkColor(colorKey);
      });
    });

    this._updateColorButtons();
    this._updateRandomColorOption();
  }

  /**
   * カテゴリカードのセットアップ
   */
  _setupCategoryCards() {
    this.fireworkCategoryCards = Array.from(
      document.querySelectorAll(".firework-type-card")
    ).filter((card) => fireWorkCategory[card.dataset.fireworkType]);

    this.fireworkCategoryCards.forEach((card) => {
      card.addEventListener("click", () => {
        const typeKey = card.dataset.fireworkType;
        if (!typeKey || typeKey === this.activeFireworkCategoryKey) {
          return;
        }
        this.setFireworkCategory(typeKey);
      });
    });

    this._updateCategoryCards();
  }

  /**
   * モードタブのセットアップ
   */
  _setupModeTabs() {
    const defaultModeTab = document.querySelector(".panel-tab.is-active");
    this.activeMode = defaultModeTab?.dataset.mode ?? "solo";
    this.modeTabs = Array.from(document.querySelectorAll(".panel-tab"));

    this.modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.dataset.mode) {
          this.setMode(tab.dataset.mode);
        }
      });
    });
  }

  /**
   * バーストタイプカードのセットアップ
   */
  _setupBurstTypeCards() {
    this.burstTypeSection = document.querySelector(
      '[data-section="burst-type"]'
    );
    this.burstTypeCards = Array.from(
      document.querySelectorAll(
        '.firework-type-card[data-firework-type="sokuhatsu"], .firework-type-card[data-firework-type="renpatsu"]'
      )
    );

    this.activeBurstTypeKey =
      this.burstTypeCards.find((card) => card.classList.contains("is-active"))
        ?.dataset.fireworkType || "renpatsu";

    this.burstTypeCards.forEach((card) => {
      card.addEventListener("click", () => {
        if (!this._isBurstTypeEnabled()) {
          return;
        }
        const typeKey = card.dataset.fireworkType;
        if (!typeKey || typeKey === this.activeBurstTypeKey) {
          return;
        }
        this.activeBurstTypeKey = typeKey;
        this._updateBurstTypeCards();
      });
    });

    this._updateBurstTypeAvailability();
  }

  /**
   * 高さスライダーのセットアップ
   */
  _setupHeightSlider() {
    this.heightSlider = document.getElementById("heightSlider");
    this.heightValue = document.getElementById("heightValue");

    if (this.heightSlider) {
      this.heightSlider.value = String(params.height);
      this._syncHeightValue(params.height);

      this.heightSlider.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        this._syncHeightValue(target.value);
      });
    }
  }

  /**
   * サイドバートグルのセットアップ
   */
  _setupSidebarToggle() {
    this.sidebar = document.getElementById("sidebar");
    this.controlPanelContainer = document.querySelector(
      ".control-panel-container"
    );

    if (this.sidebar && this.controlPanelContainer) {
      this.sidebar.addEventListener("toggle", () =>
        this._updateControlPanelOffset()
      );
      this._updateControlPanelOffset();
    }
  }

  /**
   * 花火の色を設定
   */
  setFireworkColor(colorKeyOrHex) {
    if (colorKeyOrHex === randomColorKey) {
      this.activeFireworkColorKey = randomColorKey;
      this.activeRandomResolvedKey = this._getRandomPresetKey();
      const randomHex = resolveFireworkHex(this.activeRandomResolvedKey);
      this._updateColorButtons();
      if (this.onColorChange && randomHex) {
        this.onColorChange(randomHex, randomColorKey);
      }
      return;
    }

    const colorHex = resolveFireworkHex(colorKeyOrHex);
    if (!colorHex) {
      console.warn(`Firework color "${colorKeyOrHex}" is not defined.`);
      return;
    }

    const presetKey = resolveFireworkPresetKey(colorKeyOrHex);
    if (presetKey) {
      this.activeFireworkColorKey = presetKey;
    }
    params.fireworkColor = colorHex;

    this._updateColorButtons();

    if (this.onColorChange) {
      this.onColorChange(colorHex, this.activeFireworkColorKey);
    }
  }

  /**
   * 花火のカテゴリを設定
   */
  setFireworkCategory(categoryKey) {
    const categoryLabel = fireWorkCategory[categoryKey];
    if (!categoryLabel) {
      return;
    }

    if (categoryKey === this.activeFireworkCategoryKey) {
      this._updateCategoryCards();
      return;
    }

    this.activeFireworkCategoryKey = categoryKey;
    params.category = categoryLabel;
    this._updateCategoryCards();

    if (this.onCategoryChange) {
      this.onCategoryChange(categoryKey);
    }
  }

  /**
   * モードを設定
   */
  setMode(mode) {
    if (!mode) {
      return;
    }
    this.activeMode = mode;

    this.modeTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.mode === mode);
    });

    this._updateBurstTypeAvailability();
    this._updateRandomColorOption();

    if (this.onModeChange) {
      this.onModeChange(mode);
    }
  }

  /**
   * 選択をサイドバーに適用
   */
  applySelection(selection) {
    if (!selection) {
      return;
    }

    if (selection.mode) {
      this.setMode(selection.mode);
    }
    if (selection.burstType) {
      this.activeBurstTypeKey = selection.burstType;
      this._updateBurstTypeCards();
    }
    if (selection.fireworkType) {
      this.setFireworkCategory(selection.fireworkType);
    }

    const colorKeyOrHex =
      selection.fireworkColorKey ?? selection.fireworkColor ?? undefined;
    if (colorKeyOrHex) {
      this.setFireworkColor(colorKeyOrHex);
    }

    if (Number.isFinite(selection.launchHeight)) {
      if (this.heightSlider) {
        this.heightSlider.value = String(selection.launchHeight);
      }
      this._syncHeightValue(selection.launchHeight);
    }
  }

  /**
   * 現在の選択を作成
   */
  createSelection() {
    const { colorKeyForSelection, randomColorKeys } =
      this._resolveColorKeyForSelection();
    const fireworkColorHex =
      resolveFireworkHex(colorKeyForSelection) ?? params.fireworkColor;
    const secondaryColorHex = resolveSecondaryPresetKey(colorKeyForSelection);
    const launchHeight = Number(this.heightSlider?.value);

    return {
      numberOfParticles:
        category[this.activeFireworkCategoryKey].numberOfParticles,
      pointSize: category[this.activeFireworkCategoryKey].pointSize,
      radius: category[this.activeFireworkCategoryKey].radius,
      bloomDuration: category[this.activeFireworkCategoryKey].bloomDuration,
      useEaseInSine:
        category[this.activeFireworkCategoryKey].useEaseInSine ?? false,
      fireworkType: this.activeFireworkCategoryKey,
      fireworkColor: fireworkColorHex,
      fireworkColorKey: randomColorKeys ? randomColorKey : colorKeyForSelection,
      randomColorKeys,
      secondary:
        this.activeFireworkCategoryKey === "botan" ||
        this.activeFireworkCategoryKey === "meshibe"
          ? secondaryColorHex
          : undefined,
      launchHeight: launchHeight,
      times: category[this.activeFireworkCategoryKey].times,
      gravityStrength: category[this.activeFireworkCategoryKey].gravityStrength,
      mode: this.activeMode,
      burstType: this._isBurstTypeEnabled()
        ? this.activeBurstTypeKey
        : undefined,
    };
  }

  // === プライベートメソッド ===

  _updateColorButtons() {
    this.fireworkColorButtons.forEach((button) => {
      const buttonKey = button.dataset.fireworkColor;
      button.classList.toggle(
        "is-active",
        buttonKey === this.activeFireworkColorKey
      );
    });
  }

  _updateCategoryCards() {
    this.fireworkCategoryCards.forEach((card) => {
      const key = card.dataset.fireworkType;
      card.classList.toggle(
        "is-active",
        key === this.activeFireworkCategoryKey
      );
    });
  }

  _updateBurstTypeCards() {
    this.burstTypeCards.forEach((card) => {
      card.classList.toggle(
        "is-active",
        card.dataset.fireworkType === this.activeBurstTypeKey
      );
    });
  }

  _isBurstTypeEnabled() {
    return this.activeMode === "burst";
  }

  _updateBurstTypeAvailability() {
    const enabled = this._isBurstTypeEnabled();

    this.burstTypeCards.forEach((card) => {
      card.classList.toggle("is-disabled", !enabled);
      card.setAttribute("aria-disabled", String(!enabled));
    });

    if (this.burstTypeSection) {
      this.burstTypeSection.classList.toggle("is-hidden", !enabled);
      this.burstTypeSection.setAttribute("aria-hidden", String(!enabled));
    }

    if (enabled) {
      this._updateBurstTypeCards();
    }
  }

  _updateRandomColorOption() {
    const enabled = this._isBurstTypeEnabled();
    if (this.randomColorButton) {
      this.randomColorButton.style.display = enabled ? "" : "none";
      this.randomColorButton.setAttribute("aria-hidden", String(!enabled));
    }
    if (!enabled && this.activeFireworkColorKey === randomColorKey) {
      this.setFireworkColor(defaultFireworkColorKey);
    }
  }

  _syncHeightValue(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return;
    }

    params.height = numericValue;

    if (this.heightValue) {
      this.heightValue.textContent = `${numericValue}m`;
    }

    if (this.onHeightChange) {
      this.onHeightChange(numericValue);
    }
  }

  _updateControlPanelOffset() {
    if (!this.controlPanelContainer || !this.sidebar) {
      return;
    }
    this.controlPanelContainer.classList.toggle(
      "is-open",
      this.sidebar.matches(":popover-open")
    );
  }

  // === ゲッター ===

  getActiveColorKey() {
    return this.activeFireworkColorKey;
  }

  getActiveCategoryKey() {
    return this.activeFireworkCategoryKey;
  }

  getActiveMode() {
    return this.activeMode;
  }

  getActiveBurstType() {
    return this.activeBurstTypeKey;
  }

  getLaunchHeight() {
    return Number(this.heightSlider?.value) || params.height;
  }

  _getRandomPresetKey() {
    const presetKeys = Object.keys(fireworkColorPresets);
    const index = Math.floor(Math.random() * presetKeys.length);
    return presetKeys[index] ?? defaultFireworkColorKey;
  }

  _resolveColorKeyForSelection() {
    if (
      this._isBurstTypeEnabled() &&
      this.activeFireworkColorKey === randomColorKey
    ) {
      const randomColorKeys = this._getUniqueRandomPresetKeys(5);
      const chosen = randomColorKeys[0];
      this.activeRandomResolvedKey = chosen;
      return { colorKeyForSelection: chosen, randomColorKeys };
    }
    return {
      colorKeyForSelection: this.activeFireworkColorKey,
      randomColorKeys: undefined,
    };
  }

  _getUniqueRandomPresetKeys(count) {
    const presetKeys = Object.keys(fireworkColorPresets);
    const shuffled = [...presetKeys].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
