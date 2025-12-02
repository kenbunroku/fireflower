/**
 * Timeline Module
 * タイムラインUI・再生制御
 */

import {
  fireworkColorPresets,
  maxTimelineSelections,
  timelineModeIcons,
  timelineModeLabels,
  timelinePlaybackDurationMs,
} from "./constant.js";

/**
 * タイムラインマネージャークラス
 */
export class TimelineManager {
  constructor(options = {}) {
    this.scene = options.scene;
    this.fireworkManager = options.fireworkManager;
    this.modelPositionStore = options.modelPositionStore;
    this.onRandomFireworkStart = options.onRandomFireworkStart;
    this.onRandomFireworkStop = options.onRandomFireworkStop;
    this.resetFireworkAudioState = options.resetFireworkAudioState;

    // 状態
    this.timelineSelections = [];
    this.timelineSelectedFireworks = [];
    this.timelineCards = [];
    this.activeTimelineSelectionIndex = undefined;
    this.isTimelineProgressPlaying = false;
    this.isTimelineSequenceActive = false;
    this.isTimelineLooping = false;
    this.activeTimelineBurstStops = new Set();
    this.activeTimelineProgressCardIndex = undefined;

    // タイマーID
    this.timelineProgressAnimationId = undefined;
    this.timelineSequenceTimeoutId = undefined;

    // DOM要素
    this.timelinePanel = null;
    this.timelineCarousel = null;
    this.timelineClearButton = null;
    this.timelinePlayButton = null;
    this.deleteFireworkButton = null;
    this.addFireworkButton = null;
  }

  /**
   * DOM要素を設定
   */
  setElements({
    timelinePanel,
    timelineCarousel,
    timelineClearButton,
    timelinePlayButton,
    addFireworkButton,
  }) {
    this.timelinePanel = timelinePanel;
    this.timelineCarousel = timelineCarousel;
    this.timelineClearButton = timelineClearButton;
    this.timelinePlayButton = timelinePlayButton;
    this.addFireworkButton = addFireworkButton;

    // 既存のカードを取得
    if (timelineCarousel) {
      this.timelineCards = Array.from(
        timelineCarousel.querySelectorAll(".timeline-card")
      );
      this.timelineCards.forEach((card) => this._registerTimelineCard(card));
    }

    // イベントリスナーを設定
    this._setupEventListeners();
    this._updatePanelVisibility();
  }

  /**
   * イベントリスナーを設定
   */
  _setupEventListeners() {
    if (this.timelineClearButton) {
      this.timelineClearButton.addEventListener("click", () => this.clear());
    }

    if (this.timelinePlayButton) {
      this.timelinePlayButton.addEventListener("click", () =>
        this._handlePlayButtonClick()
      );
    }
  }

  /**
   * 再生ボタンクリック処理
   */
  _handlePlayButtonClick() {
    if (this.onRandomFireworkStop) {
      this.onRandomFireworkStop();
    }

    if (this.isTimelineProgressPlaying) {
      this.fireworkManager.pauseAnimationForGroup("timeline");
      this._stopProgressAnimation({ keepLooping: true });
      return;
    }

    this.fireworkManager.resumeAnimationForGroup("timeline");

    if (this.timelineSelections.length === 0) {
      return;
    }

    const restartSequence = () => {
      if (!this.isTimelineLooping) {
        return;
      }
      this._stopPlaybackSequence({ keepLooping: true });
      this._playSelectionsSequentially();
    };

    this.isTimelineLooping = true;
    this._stopPlaybackSequence({ keepLooping: true });
    restartSequence();

    this._startProgressAnimation({
      loop: true,
      onLoop: restartSequence,
    });
  }

  /**
   * 選択を追加
   */
  addSelection(selection) {
    if (this.timelineSelections.length >= maxTimelineSelections) {
      return false;
    }

    this.timelineSelections.push(selection);
    this._addTimelineCard({
      ...selection,
      selectionIndex: this.timelineSelections.length - 1,
    });
    this._updatePanelVisibility();
    return true;
  }

  /**
   * 選択を更新
   */
  updateSelection(index, selection) {
    if (index < 0 || index >= this.timelineSelections.length) {
      return false;
    }

    this.timelineSelections[index] = selection;
    const targetCard = this.timelineCards.find(
      (card) => Number(card.dataset.selectionIndex) === index
    );
    this._updateTimelineCard(targetCard, selection, index);
    return true;
  }

  /**
   * 選択を削除
   */
  deleteSelection(index) {
    if (index < 0 || index >= this.timelineSelections.length) {
      return false;
    }

    this.timelineSelections.splice(index, 1);

    const targetCard = this.timelineCards.find(
      (card) => Number(card.dataset.selectionIndex) === index
    );
    if (targetCard) {
      this._removeTimelineCardElement(targetCard);
    }

    this.timelineCards = this.timelineCards.filter(
      (card) => Number(card.dataset.selectionIndex) !== index
    );

    this._reindexTimelineCards();
    this.activeTimelineSelectionIndex = undefined;
    this._updatePanelVisibility();

    return true;
  }

  /**
   * タイムラインをクリア
   */
  clear() {
    this._stopProgressAnimation({ reset: true });
    this._stopPlaybackSequence();
    this._clearFireworkPrimitives();
    this._resetAllCardProgress();

    this.timelineSelections.length = 0;
    this.timelineCards.forEach((card) => this._removeTimelineCardElement(card));
    this.timelineCards = [];

    if (this.timelineCarousel) {
      this.timelineCarousel.innerHTML = "";
    }

    this.activeTimelineSelectionIndex = undefined;
    this._updatePanelVisibility();

    this.fireworkManager.resetPauseStateForGroup("timeline");

    if (this.onRandomFireworkStart) {
      this.onRandomFireworkStart();
    }
  }

  /**
   * アクティブな選択インデックスを取得
   */
  getActiveSelectionIndex() {
    return this.activeTimelineSelectionIndex;
  }

  /**
   * 選択数を取得
   */
  getSelectionCount() {
    return this.timelineSelections.length;
  }

  /**
   * 最大選択数に達しているか
   */
  isAtMaxSelections() {
    return this.timelineSelections.length >= maxTimelineSelections;
  }

  // === プライベートメソッド ===

  _updatePanelVisibility() {
    if (this.timelinePanel) {
      this.timelinePanel.style.display =
        this.timelineSelections.length === 0 ? "none" : "";
    }
    if (this.timelineClearButton) {
      this.timelineClearButton.style.display =
        this.timelineSelections.length > 0 ? "" : "none";
    }
  }

  _getTimelineCardWrapper(card) {
    const parent = card?.parentElement;
    if (parent?.classList.contains("timeline-card-wrapper")) {
      return parent;
    }
    return undefined;
  }

  _setTimelineCardWrapperProgress(card, progress = 0) {
    const wrapper = this._getTimelineCardWrapper(card);
    if (!wrapper) {
      return;
    }
    const clamped = Math.max(0, Math.min(100, progress));
    wrapper.style.setProperty("--progress", String(clamped));
    wrapper.classList.toggle("is-progressing", clamped > 0);
  }

  _resetTimelineCardWrapperProgress(card) {
    this._setTimelineCardWrapperProgress(card, 0);
  }

  _resetAllCardProgress() {
    this.activeTimelineProgressCardIndex = undefined;
    this.timelineCards.forEach((card) =>
      this._resetTimelineCardWrapperProgress(card)
    );
  }

  _registerTimelineCard(card) {
    if (!card) {
      return;
    }
    this._resetTimelineCardWrapperProgress(card);

    const editIcon = this._ensureTimelineCardEditIcon(card);
    if (editIcon) {
      editIcon.addEventListener("click", (event) => {
        event.stopPropagation();
        this._handleTimelineCardClick(card);
      });
    }
    card.addEventListener("click", () => this._handleTimelineCardClick(card));
  }

  _ensureTimelineCardEditIcon(card) {
    if (!card) {
      return undefined;
    }
    const existing = card.querySelector(".timeline-card__edit");
    if (existing) {
      return existing;
    }
    const editIcon = document.createElement("span");
    editIcon.className = "material-icons-outlined timeline-card__edit";
    editIcon.textContent = "edit";
    card.appendChild(editIcon);
    return editIcon;
  }

  _handleTimelineCardClick(card) {
    this._setActiveTimelineCard(card);
  }

  _setActiveTimelineCard(targetCard) {
    this.timelineCards.forEach((card) => {
      card.classList.toggle("is-active", card === targetCard);
    });

    this.activeTimelineSelectionIndex = undefined;
    if (targetCard?.dataset.selectionIndex) {
      const selectionIndex = Number(targetCard.dataset.selectionIndex);
      if (Number.isFinite(selectionIndex)) {
        this.activeTimelineSelectionIndex = selectionIndex;
      }
    }
  }

  _removeTimelineCardElement(card) {
    if (!card) {
      return;
    }
    const parent = card.parentElement;
    if (parent?.classList.contains("timeline-card-wrapper")) {
      parent.remove();
      return;
    }
    card.remove();
  }

  _addTimelineCard({
    fireworkType,
    fireworkColor,
    launchHeight,
    fireworkColorKey,
    mode,
    burstType,
    selectionIndex,
  }) {
    if (!this.timelineCarousel) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "timeline-card-wrapper";

    const card = document.createElement("div");
    card.className = "timeline-card";
    card.dataset.fireworkType = fireworkType;
    card.dataset.fireworkColor = fireworkColorKey;
    card.dataset.launchHeight = String(launchHeight);
    if (mode) card.dataset.mode = mode;
    if (burstType) card.dataset.burstType = burstType;
    if (Number.isFinite(selectionIndex)) {
      card.dataset.selectionIndex = String(selectionIndex);
    }

    const title = document.createElement("span");
    title.className = "timeline-card__title";

    const meta = document.createElement("span");
    meta.className = "timeline-card__meta";

    const colorLabel = fireworkColorPresets[fireworkColorKey]
      ? fireworkColorKey
      : fireworkColor?.toUpperCase() || "CUSTOM";

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "timeline-card__color";
    colorIndicator.style.backgroundColor =
      fireworkColor || fireworkColorPresets[fireworkColorKey]?.hex || "#fff";

    const modeLabel =
      (mode && timelineModeLabels[mode]) || timelineModeLabels.solo;
    const modeIcon =
      (mode && timelineModeIcons[mode]) || timelineModeIcons.solo;

    colorIndicator.title = modeLabel;
    colorIndicator.setAttribute("role", "img");
    colorIndicator.setAttribute("aria-label", `${modeLabel} / ${colorLabel}`);

    const colorIndicatorIcon = document.createElement("span");
    colorIndicatorIcon.className =
      "material-icons-outlined timeline-card__color-icon";
    colorIndicatorIcon.textContent = modeIcon;
    colorIndicator.appendChild(colorIndicatorIcon);

    card.append(colorIndicator, title, meta);
    wrapper.appendChild(card);
    this._resetTimelineCardWrapperProgress(card);
    this.timelineCarousel.appendChild(wrapper);
    this.timelineCards.push(card);
    this._registerTimelineCard(card);
  }

  _updateTimelineCard(card, selection, selectionIndex) {
    if (!card || !selection) {
      return;
    }

    card.dataset.fireworkType = selection.fireworkType;
    card.dataset.fireworkColor = selection.fireworkColorKey;
    card.dataset.launchHeight = String(selection.launchHeight);
    if (selection.mode) card.dataset.mode = selection.mode;
    if (selection.burstType) {
      card.dataset.burstType = selection.burstType;
    } else {
      delete card.dataset.burstType;
    }
    if (Number.isFinite(selectionIndex)) {
      card.dataset.selectionIndex = String(selectionIndex);
    }

    const colorIndicator = card.querySelector(".timeline-card__color");
    if (colorIndicator) {
      colorIndicator.style.backgroundColor =
        selection.fireworkColor ||
        fireworkColorPresets[selection.fireworkColorKey]?.hex ||
        "#fff";

      const modeLabel =
        (selection.mode && timelineModeLabels[selection.mode]) ||
        timelineModeLabels.solo;
      const colorLabel = fireworkColorPresets[selection.fireworkColorKey]
        ? selection.fireworkColorKey
        : selection.fireworkColor?.toUpperCase() || "CUSTOM";

      colorIndicator.title = modeLabel;
      colorIndicator.setAttribute("aria-label", `${modeLabel} / ${colorLabel}`);

      const icon = colorIndicator.querySelector(".timeline-card__color-icon");
      if (icon) {
        icon.textContent =
          (selection.mode && timelineModeIcons[selection.mode]) ||
          timelineModeIcons.solo;
      }
    }
  }

  _reindexTimelineCards() {
    this.timelineCards.forEach((card, index) => {
      card.dataset.selectionIndex = String(index);
    });
  }

  _clearFireworkPrimitives() {
    this.timelineSelectedFireworks.forEach((firework) => {
      if (firework?.primitive && !firework.primitive.isDestroyed?.()) {
        this.scene.primitives.remove(firework.primitive);
      }
    });
    this.timelineSelectedFireworks.length = 0;
  }

  _triggerTimelineSelection(selection) {
    const matrix = selection.matrix;
    const heartPositions = this.modelPositionStore?.getHeartPositions();
    const lovePositions = this.modelPositionStore?.getLovePositions();

    if (
      selection.fireworkType === "botan" ||
      selection.fireworkColor === "meshibe"
    ) {
      const innerRadius = selection.radius * 0.6;
      const outerRadius = selection.radius * 1.2;

      const innerFirework = this.fireworkManager.createFirework({
        ...selection,
        radius: innerRadius,
        fireworkColor: selection.fireworkColor,
        matrix,
        group: "timeline",
      });
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(innerFirework);
      }
      this.timelineSelectedFireworks.push(innerFirework);

      const outerFirework = this.fireworkManager.createFirework({
        ...selection,
        radius: outerRadius,
        fireworkColor: selection.secondary,
        matrix,
        group: "timeline",
      });
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(outerFirework);
      }
      this.timelineSelectedFireworks.push(outerFirework);
    } else if (selection.fireworkType === "heart") {
      const firework = this.fireworkManager.createFirework({
        ...selection,
        modelPositions: heartPositions,
        matrix,
        group: "timeline",
      });
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(firework);
      }
      this.timelineSelectedFireworks.push(firework);
    } else if (selection.fireworkType === "love") {
      const firework = this.fireworkManager.createFirework({
        ...selection,
        modelPositions: lovePositions,
        matrix,
        group: "timeline",
      });
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(firework);
      }
      this.timelineSelectedFireworks.push(firework);
    } else {
      const firework = this.fireworkManager.createFirework({
        ...selection,
        matrix,
        group: "timeline",
      });
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(firework);
      }
      this.timelineSelectedFireworks.push(firework);
    }
  }

  _playSelectionsSequentially(
    selections = this.timelineSelections,
    { durationMs = timelinePlaybackDurationMs, onComplete } = {}
  ) {
    if (selections.length === 0) {
      return;
    }

    this._stopPlaybackSequence({ keepLooping: this.isTimelineLooping });
    this.isTimelineSequenceActive = true;
    const delayMs = durationMs / Math.max(selections.length, 1);

    const step = (index) => {
      if (!this.isTimelineSequenceActive) {
        return;
      }
      const selection = selections[index];
      if (!selection) {
        return;
      }

      const count = selection.mode === "burst" ? 5 : 1;
      const isSokuhatsu = selection.burstType === "sokuhatsu";
      const sokuhatsuDelayMs = 200;

      const launchSingle = () => {
        if (!this.isTimelineSequenceActive) {
          return;
        }
        const fireworkMatrix =
          this.fireworkManager.createRandomizedLaunchMatrix();
        selection.matrix = fireworkMatrix;
        this._triggerTimelineSelection(selection);
      };

      if (selection.mode === "burst" && isSokuhatsu) {
        const timeouts = new Set();
        const stop = () => {
          timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
          timeouts.clear();
        };
        this.activeTimelineBurstStops.add(stop);

        for (let i = 0; i < count; i++) {
          const timeoutId = window.setTimeout(() => {
            launchSingle();
            if (i === count - 1) {
              this.activeTimelineBurstStops.delete(stop);
            }
          }, i * sokuhatsuDelayMs);
          timeouts.add(timeoutId);
        }
      } else {
        for (let i = 0; i < count; i++) {
          launchSingle();
        }
      }

      if (index + 1 >= selections.length) {
        this.isTimelineSequenceActive = false;
        if (typeof onComplete === "function") {
          onComplete();
        }
        return;
      }

      this.timelineSequenceTimeoutId = window.setTimeout(
        () => step(index + 1),
        delayMs
      );
    };

    step(0);
  }

  _stopPlaybackSequence({ keepLooping = false } = {}) {
    if (this.timelineSequenceTimeoutId) {
      window.clearTimeout(this.timelineSequenceTimeoutId);
      this.timelineSequenceTimeoutId = undefined;
    }

    this.activeTimelineBurstStops.forEach((stop) => {
      try {
        stop();
      } catch (error) {
        console.error("Failed to stop burst sequence:", error);
      }
    });
    this.activeTimelineBurstStops.clear();

    this.isTimelineSequenceActive = false;
    if (!keepLooping) {
      this.isTimelineLooping = false;
    }
  }

  _setPlayButtonState(isPlaying) {
    if (!this.timelinePlayButton) {
      return;
    }
    const iconName = isPlaying ? "stop" : "play_arrow";
    this.timelinePlayButton.innerHTML = `<span class="material-icons">${iconName}</span>`;
    this.timelinePlayButton.setAttribute(
      "aria-label",
      isPlaying ? "停止" : "再生"
    );
    this.timelinePlayButton.classList.toggle("is-playing", isPlaying);
  }

  _startProgressAnimation({ loop = false, onLoop } = {}) {
    if (this.onRandomFireworkStop) {
      this.onRandomFireworkStop();
    }

    this._resetAllCardProgress();
    this._stopProgressAnimation({ stopSequence: false, keepLooping: loop });

    this.isTimelineLooping = loop;
    let animationStart = performance.now();
    this.isTimelineProgressPlaying = true;
    this._setPlayButtonState(true);

    const animate = (now) => {
      const elapsed = now - animationStart;
      const ratio = Math.min(elapsed / timelinePlaybackDurationMs, 1);
      this._updateCardProgress(ratio);

      if (ratio < 1) {
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      if (loop && this.isTimelineProgressPlaying) {
        if (typeof onLoop === "function") {
          onLoop();
        }
        animationStart = now;
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      this._stopProgressAnimation();
    };

    this.timelineProgressAnimationId = requestAnimationFrame(animate);
  }

  _stopProgressAnimation({
    reset = false,
    stopSequence = true,
    keepLooping = false,
  } = {}) {
    if (this.timelineProgressAnimationId) {
      cancelAnimationFrame(this.timelineProgressAnimationId);
      this.timelineProgressAnimationId = undefined;
    }

    if (stopSequence) {
      this._stopPlaybackSequence({ keepLooping });
    } else if (!keepLooping) {
      this.isTimelineLooping = false;
    }

    if (reset) {
      this._resetAllCardProgress();
    }

    this.isTimelineProgressPlaying = false;
    this._setPlayButtonState(false);

    if (!this.isTimelineLooping && this.onRandomFireworkStart) {
      this.onRandomFireworkStart();
    }
  }

  _updateCardProgress(value, { min = 0, span = 1 } = {}) {
    if (this.timelineCards.length === 0) {
      return;
    }

    const normalized = Math.max(0, Math.min(1, (value - min) / span));
    const totalCards = this.timelineCards.length;
    const slotSize = 1 / totalCards;
    const targetIndex = Math.min(
      totalCards - 1,
      Math.floor(normalized * totalCards)
    );

    if (!Number.isFinite(targetIndex) || targetIndex < 0) {
      return;
    }

    const slotStart = slotSize * targetIndex;
    const slotProgress = Math.max(
      0,
      Math.min(1, (normalized - slotStart) / slotSize)
    );

    if (this.activeTimelineProgressCardIndex !== targetIndex) {
      if (Number.isFinite(this.activeTimelineProgressCardIndex)) {
        this._resetTimelineCardWrapperProgress(
          this.timelineCards[this.activeTimelineProgressCardIndex]
        );
      }
      this.activeTimelineProgressCardIndex = targetIndex;
      this._resetTimelineCardWrapperProgress(this.timelineCards[targetIndex]);
    }

    this._setTimelineCardWrapperProgress(
      this.timelineCards[targetIndex],
      slotProgress * 100
    );
  }
}
