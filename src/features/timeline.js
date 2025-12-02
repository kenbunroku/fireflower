/**
 * Timeline Module
 * タイムラインUI・再生制御
 * Fix: setTimeoutを廃止し、ポーリング方式に変更して一時停止時のズレを解消
 * Fix: 再開時に既発射花火のstartTimeを再計算して同期を維持
 */

import {
  fireworkColorPresets,
  maxTimelineSelections,
  timelineModeIcons,
  timelineModeLabels,
  getTimelineDurationMs,
} from "../core/constant.js";

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
    this.handleFireworkAudio = options.handleFireworkAudio;

    // 状態
    this.timelineSelections = [];
    this.timelineFireworks = []; // 各選択に対応するfirework配列（burstの場合は複数）
    this.timelineCards = [];
    this.activeTimelineSelectionIndex = undefined;
    this.isTimelineProgressPlaying = false;
    this.isTimelineLooping = false;
    this.isTimelinePaused = false; // 一時停止中かどうか
    this.activeTimelineProgressCardIndex = undefined;
    this.isInteractionLocked = false;

    // タイマーID
    this.timelineProgressAnimationId = undefined;

    // 一時停止・再開用の状態
    this.pausedProgressRatio = 0; // 一時停止時の進捗率 (0-1)
    this.playbackStartTime = 0; // 再生開始時刻
    this.progressAnimationStart = 0; // アニメーション基準時刻

    // 花火アニメーション管理用
    this.timelineAnimationFireworks = [];
    this.timelineAnimationStarted = false;

    // DOM要素
    this.timelinePanel = null;
    this.timelineCarousel = null;
    this.timelineClearButton = null;
    this.timelinePlayButton = null;
    this.deleteFireworkButton = null;
    this.addFireworkButton = null;
    this.isInteractionLocked = false;

    // 現在のタイムライン再生時間（選択数で動的に決まる）
    this.timelineDurationMs = getTimelineDurationMs(0);
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
    this._setInteractionEnabled(true);
    this._updatePlayButtonInteractivity();
    this._refreshTimelineDuration();
  }

  /**
   * イベントリスナーを設定
   */
  _setupEventListeners() {
    if (this.timelineClearButton) {
      this.timelineClearButton.addEventListener("click", () => {
        if (this.isInteractionLocked) return;
        this.clear();
      });
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

    // 再生中 → 一時停止
    if (this.isTimelineProgressPlaying) {
      this._pausePlayback();
      return;
    }

    // 一時停止中 → 再開
    if (this.isTimelinePaused) {
      this._resumePlayback();
      return;
    }

    // 停止中 → 新規再生開始
    if (this.timelineSelections.length === 0) {
      return;
    }

    this._startNewPlayback();
  }

  /**
   * 新規再生を開始
   */
  _startNewPlayback() {
    // 編集状態を解除して再生ボタンを有効化
    this.clearActiveSelection();

    const restartSequence = () => {
      if (!this.isTimelineLooping) {
        return;
      }
      // ループ時は状態を維持してリセット
      this._stopPlayback({ keepState: false });
      this._startPlayback();
    };

    this.isTimelineLooping = true;
    this.isTimelinePaused = false;
    this.pausedProgressRatio = 0;

    this._refreshTimelineDuration();
    this._stopPlayback();
    this._startPlayback();

    this._startProgressAnimation({
      loop: true,
      onLoop: restartSequence,
    });

    // タイムライン花火のアニメーションを開始
    this._startFireworkAnimation();
  }

  /**
   * 最初から再生し直す（花火の追加・更新・削除時に呼ばれる）
   */
  _restartFromBeginning() {
    // 現在の再生を停止
    this._stopPlayback();
    if (this.timelineProgressAnimationId) {
      cancelAnimationFrame(this.timelineProgressAnimationId);
      this.timelineProgressAnimationId = undefined;
    }

    // 状態をリセット
    this.isTimelinePaused = false;
    this.pausedProgressRatio = 0;
    this._resetAllCardProgress();

    // 新規再生を開始
    this._startNewPlayback();
  }

  /**
   * 一時停止
   */
  _pausePlayback() {
    // 花火アニメーションを一時停止
    this.fireworkManager.pauseAnimationForGroup("timeline");

    // 進捗率を保存
    const now = performance.now();
    const durationMs = this._getTimelineDurationMs();
    const elapsed = now - this.progressAnimationStart;
    this.pausedProgressRatio = Math.min(elapsed / durationMs, 1);

    // プログレスアニメーションを停止
    if (this.timelineProgressAnimationId) {
      cancelAnimationFrame(this.timelineProgressAnimationId);
      this.timelineProgressAnimationId = undefined;
    }

    this.isTimelineProgressPlaying = false;
    this.isTimelinePaused = true;
    this._setPlayButtonState(false);
    this._setInteractionEnabled(true);
  }

  /**
   * 再開
   */
  _resumePlayback() {
    // 花火アニメーションを再開
    this.fireworkManager.resumeAnimationForGroup("timeline");

    // 進捗率から経過時間を計算
    const durationMs = this._getTimelineDurationMs();
    const elapsedMs = this.pausedProgressRatio * durationMs;
    const now = performance.now();

    // playbackStartTimeを更新（現在時刻から経過分を引く＝開始時刻の再定義）
    this.playbackStartTime = now - elapsedMs;

    // ★重要: 既に発射済みの花火のstartTimeを再計算
    this._recalculateLaunchedFireworkStartTimes(now, elapsedMs);

    // プログレスアニメーションを再開（ポーリングも再開）
    this._resumeProgressAnimation(elapsedMs, now);

    this.isTimelineProgressPlaying = true;
    this.isTimelinePaused = false;
    this._setPlayButtonState(true);
    this._setInteractionEnabled(false);
  }

  /**
   * 既に発射済みの花火のstartTimeを再計算する
   * 花火追加によりdelayMsが変わった場合でも、アニメーションの進行状態を維持する
   */
  _recalculateLaunchedFireworkStartTimes(now, currentElapsedMs) {
    const durationMs = this._getTimelineDurationMs();
    const delayMs =
      durationMs / Math.max(this.timelineSelections.length, 1);

    this.timelineSelections.forEach((selection, selectionIndex) => {
      const fireworks = this.timelineFireworks[selectionIndex];
      if (!fireworks) return;

      const isSokuhatsu = selection.burstType === "sokuhatsu";
      const sokuhatsuDelayMs = 200;
      const baseDelayMs = selectionIndex * delayMs;

      let burstIndex = 0;

      fireworks.forEach((firework) => {
        // ペアのOuterはInnerと一緒に処理されるのでスキップ
        if (firework.isPaired && !firework.isInner) {
          return;
        }

        const burstDelay = isSokuhatsu ? burstIndex * sokuhatsuDelayMs : 0;
        const scheduledTimeMs = baseDelayMs + burstDelay;

        if (firework.hasLaunched) {
          // 既に発射済みの花火のstartTimeを再計算
          // 新しいplaybackStartTime + 本来のスケジュール時間
          const newStartTime = this.playbackStartTime + scheduledTimeMs;
          firework.startTime = newStartTime;

          // ペアの花火も同様に更新
          if (firework.isPaired && firework.pairedWith) {
            firework.pairedWith.startTime = newStartTime;
          }
        }

        // インデックスを進める（Innerまたは単独の時のみ）
        if (!firework.isPaired || firework.isInner) {
          burstIndex++;
        }
      });
    });
  }

  /**
   * 選択に対応するfireworkを作成
   */
  _createFireworksForSelection(selection, selectionIndex) {
    const heartPositions = this.modelPositionStore?.getHeartPositions();
    const lovePositions = this.modelPositionStore?.getLovePositions();
    const count = selection.mode === "burst" ? 5 : 1;
    const randomColorKeys = selection.randomColorKeys || [];
    const fireworks = [];

    const getColorKeyForIndex = (index) => {
      if (randomColorKeys.length > 0) {
        return randomColorKeys[index % randomColorKeys.length];
      }
      return selection.fireworkColorKey;
    };

    const resolvePrimaryHex = (colorKey) =>
      fireworkColorPresets[colorKey]?.hex ||
      selection.fireworkColor ||
      fireworkColorPresets[selection.fireworkColorKey]?.hex;

    const resolveSecondaryHex = (colorKey) =>
      fireworkColorPresets[colorKey]?.secondary ||
      selection.secondary ||
      resolvePrimaryHex(colorKey);

    for (let i = 0; i < count; i++) {
      const matrix = this.fireworkManager.createRandomizedLaunchMatrix();
      const colorKey = getColorKeyForIndex(i);
      const primaryHex = resolvePrimaryHex(colorKey);
      const secondaryHex = resolveSecondaryHex(colorKey);

      if (
        selection.fireworkType === "botan" ||
        selection.fireworkType === "meshibe"
      ) {
        // 内側と外側の2つのfireworkを作成（同じ中心でbloomする）
        const innerRadius = selection.radius * 0.6;
        const outerRadius = selection.radius * 1.2;

        const innerFirework = this.fireworkManager.createFirework({
          ...selection,
          radius: innerRadius,
          fireworkColor: primaryHex,
          matrix,
          group: "timeline",
        });
        innerFirework.primitive.show = false;
        innerFirework.isPaired = true;
        innerFirework.isInner = true;
        if (this.resetFireworkAudioState) {
          this.resetFireworkAudioState(innerFirework);
        }

        const outerFirework = this.fireworkManager.createFirework({
          ...selection,
          radius: outerRadius,
          fireworkColor: secondaryHex,
          matrix,
          group: "timeline",
        });
        outerFirework.primitive.show = false;
        outerFirework.isPaired = true;
        outerFirework.isInner = false;
        if (this.resetFireworkAudioState) {
          this.resetFireworkAudioState(outerFirework);
        }

        // ペアとして関連付け
        innerFirework.pairedWith = outerFirework;
        outerFirework.pairedWith = innerFirework;

        fireworks.push(innerFirework);
        fireworks.push(outerFirework);
      } else if (selection.fireworkType === "heart") {
        const firework = this.fireworkManager.createFirework({
          ...selection,
          modelPositions: heartPositions,
          matrix,
          group: "timeline",
        });
        firework.primitive.show = false;
        if (this.resetFireworkAudioState) {
          this.resetFireworkAudioState(firework);
        }
        fireworks.push(firework);
      } else if (selection.fireworkType === "love") {
        const firework = this.fireworkManager.createFirework({
          ...selection,
          modelPositions: lovePositions,
          matrix,
          group: "timeline",
        });
        firework.primitive.show = false;
        if (this.resetFireworkAudioState) {
          this.resetFireworkAudioState(firework);
        }
        fireworks.push(firework);
      } else {
        const firework = this.fireworkManager.createFirework({
          ...selection,
          fireworkColor: primaryHex,
          matrix,
          group: "timeline",
        });
        firework.primitive.show = false;
        if (this.resetFireworkAudioState) {
          this.resetFireworkAudioState(firework);
        }
        fireworks.push(firework);
      }
    }

    return fireworks;
  }

  /**
   * 選択を追加
   */
  addSelection(selection) {
    if (this.timelineSelections.length >= maxTimelineSelections) {
      return false;
    }

    // 再生中の場合は再生をリセット
    const wasPlaying = this.isTimelineProgressPlaying;
    // 一時停止中かどうか
    const wasPaused = this.isTimelinePaused;

    const selectionIndex = this.timelineSelections.length;
    this.timelineSelections.push(selection);

    // fireworkを作成
    const fireworks = this._createFireworksForSelection(
      selection,
      selectionIndex
    );
    this.timelineFireworks.push(fireworks);
    this._syncTimelineAnimationFireworks();

    this._addTimelineCard({
      ...selection,
      selectionIndex,
    });
    this._updatePanelVisibility();
    this._refreshTimelineDuration();

    // 一時停止中だった場合、新しい花火の発射状態を調整
    if (wasPaused) {
      this._adjustNewFireworksForPausedState(selectionIndex);
    }

    // 再生中だった場合のみ、最初から再生し直す
    if (wasPlaying) {
      this._restartFromBeginning();
    }

    return true;
  }

  /**
   * 一時停止中に追加された花火の発射状態を調整
   */
  _adjustNewFireworksForPausedState(selectionIndex) {
    // 現在の停止位置（経過時間）を取得
    const durationMs = this._getTimelineDurationMs();
    const elapsedMs = this.pausedProgressRatio * durationMs;

    // _checkAndLaunchFireworksを利用して、この経過時間までに発射されているべき花火を処理
    this._checkAndLaunchFireworks(elapsedMs);
  }

  /**
   * 選択を更新
   */
  updateSelection(index, selection) {
    if (index < 0 || index >= this.timelineSelections.length) {
      return false;
    }

    // 再生中の場合のみ再生をリセット（一時停止中は状態を維持）
    const wasPlaying = this.isTimelineProgressPlaying;

    // 既存のfireworkを削除
    this._removeFireworksAtIndex(index);

    // 新しいselectionを保存
    this.timelineSelections[index] = selection;

    // 新しいfireworkを作成
    const fireworks = this._createFireworksForSelection(selection, index);
    this.timelineFireworks[index] = fireworks;
    this._syncTimelineAnimationFireworks();

    const targetCard = this.timelineCards.find(
      (card) => Number(card.dataset.selectionIndex) === index
    );
    this._updateTimelineCard(targetCard, selection, index);
    this._refreshTimelineDuration();

    // 再生中だった場合のみ、最初から再生し直す
    if (wasPlaying) {
      this._restartFromBeginning();
    }

    return true;
  }

  /**
   * 指定インデックスのfireworkを削除
   */
  _removeFireworksAtIndex(index) {
    const fireworks = this.timelineFireworks[index];
    if (!fireworks) {
      return;
    }

    fireworks.forEach((firework) => {
      if (firework?.primitive && !firework.primitive.isDestroyed?.()) {
        this.scene.primitives.remove(firework.primitive);
      }
    });
  }

  /**
   * 選択を削除
   */
  deleteSelection(index) {
    if (index < 0 || index >= this.timelineSelections.length) {
      return false;
    }

    // 再生中の場合のみ再生をリセット（一時停止中は状態を維持）
    const wasPlaying = this.isTimelineProgressPlaying;

    // fireworkを削除
    this._removeFireworksAtIndex(index);

    // 配列から削除
    this.timelineSelections.splice(index, 1);
    this.timelineFireworks.splice(index, 1);
    this._syncTimelineAnimationFireworks();

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
    this._updatePlayButtonInteractivity();
    this._refreshTimelineDuration();

    // 再生中だった場合のみ、最初から再生し直す
    // ただし、全て削除された場合は再生しない
    if (wasPlaying && this.timelineSelections.length > 0) {
      this._restartFromBeginning();
    }

    return true;
  }

  /**
   * タイムラインをクリア
   */
  clear() {
    if (this.isInteractionLocked) {
      return;
    }

    this._stopProgressAnimation({ reset: true });
    this._stopPlayback();

    // 一時停止状態をリセット
    this.isTimelinePaused = false;
    this.pausedProgressRatio = 0;
    this.playbackStartTime = 0;

    // 全てのfireworkを削除
    this.timelineFireworks.forEach((fireworks) => {
      fireworks.forEach((firework) => {
        if (firework?.primitive && !firework.primitive.isDestroyed?.()) {
          this.scene.primitives.remove(firework.primitive);
        }
      });
    });
    this.timelineFireworks = [];
    this._syncTimelineAnimationFireworks();

    this._resetAllCardProgress();

    this.timelineSelections.length = 0;
    this.timelineCards.forEach((card) => this._removeTimelineCardElement(card));
    this.timelineCards = [];

    if (this.timelineCarousel) {
      this.timelineCarousel.innerHTML = "";
    }

    this.activeTimelineSelectionIndex = undefined;
    this._updatePanelVisibility();
    this._updatePlayButtonInteractivity();
    this._refreshTimelineDuration();

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
   * 編集状態を解除（アクティブカードのハイライトを外す）
   */
  clearActiveSelection() {
    this.activeTimelineSelectionIndex = undefined;
    this.timelineCards.forEach((card) => card.classList.remove("is-active"));
    this._updatePlayButtonInteractivity();
  }

  /**
   * 選択数を取得
   */
  getSelectionCount() {
    return this.timelineSelections.length;
  }

  /**
   * インタラクションがロックされているか
   */
  isLocked() {
    return this.isInteractionLocked;
  }

  /**
   * 最大選択数に達しているか
   */
  isAtMaxSelections() {
    return this.timelineSelections.length >= maxTimelineSelections;
  }

  /**
   * 選択数に応じた再生時間を再計算
   */
  _refreshTimelineDuration() {
    this.timelineDurationMs = getTimelineDurationMs(
      this.timelineSelections.length
    );
    return this.timelineDurationMs;
  }

  /**
   * 現在の再生時間を取得（未設定の場合は再計算）
   */
  _getTimelineDurationMs() {
    if (!this.timelineDurationMs) {
      return this._refreshTimelineDuration();
    }
    return this.timelineDurationMs;
  }

  // === 再生制御 ===

  /**
   * 再生を開始
   */
  _startPlayback() {
    const now = performance.now();
    this.playbackStartTime = now; // 再生開始時刻を記録
    // setTimeoutによるスケジュールは行わず、
    // _startProgressAnimation内のループ(_checkAndLaunchFireworks)で制御する
  }

  /**
   * 経過時間に基づいて花火の発射をチェック・実行する
   * @param {number} elapsedMs - 再生開始からの経過時間
   */
  _checkAndLaunchFireworks(elapsedMs) {
    const durationMs = this._getTimelineDurationMs();
    const delayMs =
      durationMs / Math.max(this.timelineSelections.length, 1);

    this.timelineSelections.forEach((selection, selectionIndex) => {
      const fireworks = this.timelineFireworks[selectionIndex];
      if (!fireworks) return;

      const isSokuhatsu = selection.burstType === "sokuhatsu";
      const sokuhatsuDelayMs = 200;
      const baseDelayMs = selectionIndex * delayMs;

      let burstIndex = 0;

      // 各花火をチェック
      fireworks.forEach((firework) => {
        // 既に発射済みならスキップ
        if (firework.hasLaunched) {
          // Burstインデックスのカウントアップ
          // ペアではない、またはペアのInnerの場合のみカウントアップ
          if (!firework.isPaired || (firework.isPaired && firework.isInner)) {
            burstIndex++;
          }
          return;
        }

        // ペアのOuterはInnerの処理時に一緒に処理されるのでスキップ
        if (firework.isPaired && !firework.isInner) {
          return;
        }

        // 発射予定時刻を計算
        const burstDelay = isSokuhatsu ? burstIndex * sokuhatsuDelayMs : 0;
        const scheduledTimeMs = baseDelayMs + burstDelay;

        // 時間が経過しているかチェック
        if (scheduledTimeMs <= elapsedMs) {
          // 発射実行
          const preciseLaunchTime = this.playbackStartTime + scheduledTimeMs;

          if (firework.isPaired && firework.isInner && firework.pairedWith) {
            // ペア同時発射
            const inner = firework;
            const outer = firework.pairedWith;

            const sharedMatrix = this._launchFirework(inner, preciseLaunchTime);
            this._launchFirework(outer, preciseLaunchTime, sharedMatrix);
          } else {
            // 単独発射
            this._launchFirework(firework, preciseLaunchTime);
          }
        }

        // インデックスを進める（Innerまたは単独の時のみ）
        burstIndex++;
      });
    });
  }

  /**
   * 花火を発射
   * @param {Object} firework - 発射する花火
   * @param {number} startTime - 開始時刻
   * @param {Object} [sharedMatrix] - ペアの花火と共有するmatrix（オプション）
   */
  _launchFirework(firework, startTime, sharedMatrix = null) {
    if (!firework) {
      return;
    }

    // 位置を設定（sharedMatrixがあればそれを使用、なければ新規作成）
    const newMatrix =
      sharedMatrix || this.fireworkManager.createRandomizedLaunchMatrix();
    firework.primitive.modelMatrix = newMatrix;

    // アニメーション状態をリセット
    firework.startTime = startTime;
    // 発射時点までに経過した一時停止時間を控えておくことで、
    // 途中で花火を追加しても再開後に停止位置から正しく進行する
    firework.pauseOffsetAtStart = this._getTimelinePauseOffset(startTime);
    firework.hasLaunched = true; // 発射済みフラグ

    if (this.resetFireworkAudioState) {
      this.resetFireworkAudioState(firework);
    }

    // uniformsをリセット
    if (firework.appearance?.uniforms) {
      firework.appearance.uniforms.u_time = 0.0;
      firework.appearance.uniforms.u_launchProgress = 0.0;
    }

    // 表示
    firework.primitive.show = true;

    return newMatrix;
  }

  /**
   * タイムライングループの累積一時停止時間を取得
   * 新規追加花火のpauseOffset初期値として利用
   */
  _getTimelinePauseOffset(now = performance.now()) {
    const state = this.fireworkManager?.groupPauseState?.timeline;
    if (!state) {
      return 0;
    }

    const pausedDuration =
      state.isAnimationPaused && state.pauseStartedMs
        ? Math.max(now - state.pauseStartedMs, 0)
        : 0;

    return state.accumulatedPauseMs + pausedDuration;
  }

  /**
   * FireworkManager.animateに渡している配列を最新のfirework一覧で上書きする
   * 参照は維持し、途中追加分も次フレームから反映させる
   */
  _syncTimelineAnimationFireworks() {
    const flatList = this.timelineFireworks.flat();
    this.timelineAnimationFireworks.splice(
      0,
      this.timelineAnimationFireworks.length,
      ...flatList
    );
    return this.timelineAnimationFireworks;
  }

  /**
   * 再生を停止
   */
  _stopPlayback({ keepState = false } = {}) {
    if (!keepState) {
      // 全てのfireworkを非表示にし、発射済みフラグをリセット
      this.timelineFireworks.forEach((fireworks) => {
        fireworks.forEach((firework) => {
          if (firework?.primitive) {
            firework.primitive.show = false;
          }
          if (firework) {
            firework.hasLaunched = false;
            // Uniformsのリセット
            if (firework.appearance?.uniforms) {
              firework.appearance.uniforms.u_time = 0.0;
              firework.appearance.uniforms.u_launchProgress = 0.0;
            }
          }
        });
      });
    }
  }

  /**
   * タイムライン花火のアニメーションを開始
   */
  _startFireworkAnimation() {
    const allFireworks = this._syncTimelineAnimationFireworks();
    if (allFireworks.length === 0) {
      return;
    }
    if (this.timelineAnimationStarted) {
      return;
    }
    this.fireworkManager.animate(
      this.timelineAnimationFireworks,
      undefined,
      this.handleFireworkAudio
    );
    this.timelineAnimationStarted = true;
  }

  /**
   * タイムライン花火のアニメーションを実行（外部から呼ばれる）
   * 注意: FireworkManager.animateは内部でrequestAnimationFrameを使用して
   * 自己ループするため、一度呼び出せば継続的に実行される
   */
  animate() {
    // この関数は後方互換性のために残す
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
    if (this.isInteractionLocked) {
      return;
    }
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
    this._updatePlayButtonInteractivity();
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
    randomColorKeys,
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

    const displayColorKey =
      fireworkColorKey === "random"
        ? randomColorKeys?.[0] || fireworkColorKey
        : fireworkColorKey;

    const colorLabel =
      fireworkColorKey === "random"
        ? "RANDOM"
        : fireworkColorPresets[fireworkColorKey]
        ? fireworkColorKey
        : fireworkColor?.toUpperCase() || "CUSTOM";

    const colorIndicator = document.createElement("span");
    colorIndicator.className = "timeline-card__color";
    if (fireworkColorKey === "random") {
      colorIndicator.style.background =
        "linear-gradient(135deg, #ff8c4e, #8775ff, #4effc1)";
    } else {
      colorIndicator.style.backgroundColor =
        fireworkColor ||
        fireworkColorPresets[displayColorKey]?.hex ||
        "#fff";
    }

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
      const displayColorKey =
        selection.fireworkColorKey === "random"
          ? selection.randomColorKeys?.[0] || selection.fireworkColorKey
          : selection.fireworkColorKey;

      if (selection.fireworkColorKey === "random") {
        colorIndicator.style.background =
          "linear-gradient(135deg, #ff8c4e, #8775ff, #4effc1)";
      } else {
        colorIndicator.style.backgroundColor =
          selection.fireworkColor ||
          fireworkColorPresets[displayColorKey]?.hex ||
          "#fff";
      }

      const modeLabel =
        (selection.mode && timelineModeLabels[selection.mode]) ||
        timelineModeLabels.solo;
      const colorLabel =
        selection.fireworkColorKey === "random"
          ? "RANDOM"
          : fireworkColorPresets[selection.fireworkColorKey]
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

  _setInteractionEnabled(isEnabled) {
    this.isInteractionLocked = !isEnabled;

    if (this.timelineClearButton) {
      this.timelineClearButton.disabled = !isEnabled;
      this.timelineClearButton.classList.toggle("is-locked", !isEnabled);
      this.timelineClearButton.setAttribute(
        "aria-disabled",
        (!isEnabled).toString()
      );
    }
    if (this.addFireworkButton) {
      this.addFireworkButton.disabled = !isEnabled;
    }

    this.timelineCards.forEach((card) => {
      card.classList.toggle("is-locked", !isEnabled);
    });

    if (this.timelinePanel) {
      const event = new CustomEvent("timeline:interaction-toggle", {
        detail: { enabled: isEnabled },
      });
      this.timelinePanel.dispatchEvent(event);
    }

    this._updatePlayButtonInteractivity();
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

  _updatePlayButtonInteractivity() {
    if (!this.timelinePlayButton) {
      return;
    }
    const lockedForOtherInteractions =
      this.isInteractionLocked && !this.isTimelineProgressPlaying;
    const isEditing = Number.isFinite(this.activeTimelineSelectionIndex);
    const shouldDisable = lockedForOtherInteractions || isEditing;
    const shouldLockClass = shouldDisable;

    this.timelinePlayButton.disabled = shouldDisable;
    this.timelinePlayButton.classList.toggle("is-locked", shouldLockClass);
    this.timelinePlayButton.setAttribute(
      "aria-disabled",
      shouldDisable.toString()
    );
  }

  _startProgressAnimation({ loop = false, onLoop } = {}) {
    if (this.onRandomFireworkStop) {
      this.onRandomFireworkStop();
    }

    this._resetAllCardProgress();
    this._stopProgressAnimation({ stopPlayback: false, keepLooping: loop });

    this.isTimelineLooping = loop;
    this.progressAnimationStart = performance.now();
    this.progressOnLoop = onLoop;
    this.isTimelineProgressPlaying = true;
    this._setPlayButtonState(true);
    this._setInteractionEnabled(false);

    const durationMs = this._getTimelineDurationMs();

    const animate = (now) => {
      const elapsed = now - this.progressAnimationStart;
      const ratio = Math.min(elapsed / durationMs, 1);
      this._updateCardProgress(ratio);

      // ★ポーリング実行：このフレームで発射すべき花火を確認
      this._checkAndLaunchFireworks(elapsed);

      if (ratio < 1) {
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      if (loop && this.isTimelineProgressPlaying) {
        if (typeof this.progressOnLoop === "function") {
          this.progressOnLoop();
        }
        this.progressAnimationStart = now;
        this.pausedProgressRatio = 0; // ループ時にリセット
        this.playbackStartTime = now; // ループ開始時に基準時刻を更新
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      this._stopProgressAnimation();
    };

    this.timelineProgressAnimationId = requestAnimationFrame(animate);
  }

  /**
   * プログレスアニメーションを再開
   * @param {number} elapsedMs - 経過時間（ミリ秒）
   * @param {number} now - 現在時刻（performance.now()）
   */
  _resumeProgressAnimation(elapsedMs, now = performance.now()) {
    // 経過時間を考慮して開始時刻を調整
    this.progressAnimationStart = now - elapsedMs;

    const durationMs = this._getTimelineDurationMs();

    const animate = (now) => {
      const elapsed = now - this.progressAnimationStart;
      const ratio = Math.min(elapsed / durationMs, 1);
      this._updateCardProgress(ratio);

      // ★ポーリング実行
      this._checkAndLaunchFireworks(elapsed);

      if (ratio < 1) {
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      if (this.isTimelineLooping && this.isTimelineProgressPlaying) {
        if (typeof this.progressOnLoop === "function") {
          this.progressOnLoop();
        }
        this.progressAnimationStart = now;
        this.pausedProgressRatio = 0; // ループ時にリセット
        this.playbackStartTime = now; // ループ開始時に基準時刻を更新
        this.timelineProgressAnimationId = requestAnimationFrame(animate);
        return;
      }

      this._stopProgressAnimation();
    };

    this.timelineProgressAnimationId = requestAnimationFrame(animate);
  }

  _stopProgressAnimation({
    reset = false,
    stopPlayback = true,
    keepLooping = false,
  } = {}) {
    if (this.timelineProgressAnimationId) {
      cancelAnimationFrame(this.timelineProgressAnimationId);
      this.timelineProgressAnimationId = undefined;
    }

    if (stopPlayback) {
      this._stopPlayback();
    }

    if (!keepLooping) {
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
