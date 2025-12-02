/**
 * Random Fireworks Module
 * ランダム花火の生成とアイドルループ管理
 */

import {
  category,
  defaultFireworkColorKey,
  fireworkColorPresets,
  params,
} from "./constant.js";

/**
 * ランダムな色キーを選択
 */
const pickRandomColorKey = () => {
  const presetKeys = Object.keys(fireworkColorPresets);
  if (presetKeys.length === 0) {
    return defaultFireworkColorKey;
  }
  const randomIndex = Math.floor(Math.random() * presetKeys.length);
  return presetKeys[randomIndex] ?? defaultFireworkColorKey;
};

/**
 * ランダム花火マネージャークラス
 */
export class RandomFireworksManager {
  constructor(options = {}) {
    this.fireworkManager = options.fireworkManager;
    this.modelPositionStore = options.modelPositionStore;
    this.resetFireworkAudioState = options.resetFireworkAudioState;
    this.handleFireworkAudio = options.handleFireworkAudio;

    this.fireworks = [];
    this.isIdleLooping = false;
    this.idleLoopTimeoutId = undefined;
    this.isAnimationEnabled = true;
  }

  /**
   * ランダム花火を作成
   */
  createRandomFirework(startDelayMs = 0) {
    const heartPositions = this.modelPositionStore?.getHeartPositions();
    const lovePositions = this.modelPositionStore?.getLovePositions();

    const availableCategories = Object.entries(category)
      .filter(([, value]) => (value?.numberOfParticles ?? 0) > 0)
      .map(([key]) => key);

    const categoryKeys =
      availableCategories.length > 0
        ? availableCategories
        : Object.keys(category);

    const categoryKey =
      categoryKeys[Math.floor(Math.random() * categoryKeys.length)] || "kiku";

    const colorKey = pickRandomColorKey();
    const fireworkColor =
      fireworkColorPresets[colorKey]?.hex ?? params.fireworkColor;

    const modelPositions =
      categoryKey === "heart"
        ? heartPositions
        : categoryKey === "love"
        ? lovePositions
        : undefined;

    const firework = this.fireworkManager.createFirework({
      ...category[categoryKey],
      fireworkColor,
      modelPositions,
      matrix: this.fireworkManager.createRandomizedLaunchMatrix(),
      startDelayMs,
      group: "random",
    });

    if (this.resetFireworkAudioState) {
      this.resetFireworkAudioState(firework);
    }

    firework.originalColorKey = colorKey;
    firework.keepOriginalColor = true;
    this.fireworks.push(firework);

    return firework;
  }

  /**
   * 複数のランダム花火を作成
   */
  createRandomFireworks(count = 5) {
    const total = Math.max(Math.floor(count), 0);
    for (let i = 0; i < total; i++) {
      const delayMs = i * (params.interval * 1000 || 0);
      this.createRandomFirework(delayMs);
    }
  }

  /**
   * 花火を順番にスケジュール
   */
  scheduleFireworksSequentially() {
    const spacingMs = Math.max(params.interval * 1500, 0);
    this.fireworks.forEach((firework, index) => {
      firework.startDelayMs = index * spacingMs;
      firework.startTime = undefined;
      if (this.resetFireworkAudioState) {
        this.resetFireworkAudioState(firework);
      }
    });
  }

  /**
   * 花火の表示を設定
   */
  setVisibility(isVisible) {
    this.fireworks.forEach((firework) => {
      if (firework.primitive) {
        firework.primitive.show = isVisible;
      }
    });
  }

  /**
   * 花火の開始時刻をリセット
   */
  resetStartTimes() {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.fireworks.forEach((firework) => {
      firework.startTime = now;
    });
  }

  /**
   * アイドルループの継続時間を計算
   */
  getLoopDurationMs() {
    const spacingMs = Math.max(params.interval * 1000, 0);
    const sequentialSpanMs = spacingMs * Math.max(this.fireworks.length - 1, 0);
    const launchAndBloomMs =
      (params.launchDuration + params.bloomDuration + params.fireworkDuration) *
      1000;
    return Math.max(sequentialSpanMs + launchAndBloomMs, 1000);
  }

  /**
   * アイドルループを停止
   */
  stopIdleLoop() {
    this.isIdleLooping = false;
    if (this.idleLoopTimeoutId) {
      window.clearTimeout(this.idleLoopTimeoutId);
      this.idleLoopTimeoutId = undefined;
    }
  }

  /**
   * アイドルループを開始
   */
  startIdleLoop() {
    if (this.fireworks.length === 0) {
      return;
    }

    this.stopIdleLoop();
    this.isIdleLooping = true;
    this.setVisibility(true);

    const loopDurationMs = this.getLoopDurationMs();

    const loop = () => {
      if (!this.isIdleLooping) {
        return;
      }
      this.scheduleFireworksSequentially();
      this.resetStartTimes();
      this.idleLoopTimeoutId = window.setTimeout(loop, loopDurationMs);
    };

    loop();
  }

  /**
   * 初期花火を開始
   */
  startInitialFireworks() {
    this.createRandomFireworks(5);
    this.scheduleFireworksSequentially();
    this.startIdleLoop();
  }

  /**
   * アニメーションを有効/無効化
   */
  setAnimationEnabled(enabled) {
    this.isAnimationEnabled = enabled;
  }

  /**
   * アニメーションを実行
   */
  animate() {
    if (!this.isAnimationEnabled) {
      return;
    }
    this.fireworkManager.animate(
      this.fireworks,
      undefined,
      this.handleFireworkAudio
    );
  }

  /**
   * 花火配列を取得
   */
  getFireworks() {
    return this.fireworks;
  }
}
