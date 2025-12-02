/**
 * Main Entry Point
 * 全モジュールの統合とアプリケーション初期化
 */

import * as Cesium from "cesium";

// モジュールのインポート
import FireworkManager from "./scene/FireworkManager.js";
import { category, isDebugMode, location, params } from "./core/constant.js";

import {
  primeAudioOnInteraction,
  createAudioToggleButton,
  handleFireworkAudio,
  resetFireworkAudioState,
} from "./features/audio.js";

import { loadAllModels, modelPositionStore } from "./scene/modelLoader.js";

import {
  initViewer,
  setupBloom,
  moveFullscreenButton,
  getViewer,
  getScene,
} from "./scene/viewer.js";

import {
  loadBuildingTilesets,
  BuildingHighlighter,
  updateBuildingAppearance,
} from "./scene/buildingTileset.js";

import { CameraController } from "./scene/cameraController.js";

import { TimelineManager } from "./features/timeline.js";

import { SidebarController } from "./features/sidebarControls.js";

import { RandomFireworksManager } from "./features/randomFireworks.js";

const DIMMED_BUILDING_OPACITY = 0.25;

// === アプリケーション状態 ===
let fireworkManager;
let cameraController;
let buildingHighlighter;
let timelineManager;
let sidebarController;
let randomFireworksManager;
let fireworksInitialized = false;
let fireworksFallbackTimeoutId;
let initialFireworksStartTimeoutId;
let fireworkActionContainer;
let addFireworkButtonEl;
let deleteFireworkButtonEl;
let cancelFireworkButtonEl;
let introOverlayEl;
let startExperienceButtonEl;
let hasStartedExperience = false;
let hasCameraIntroCompleted = false;
let postIntroLoadingEl;
let postIntroLoadingBarEl;
let postIntroLoadingAnimationId;
let preStartHideElements = [];

const updateAddFireworkButtonState = () => {
  if (!addFireworkButtonEl || !timelineManager) {
    return;
  }
  if (timelineManager.isLocked?.()) {
    addFireworkButtonEl.disabled = true;
    return;
  }
  const activeIndex = timelineManager.getActiveSelectionIndex();
  const atMaxWithoutEdit =
    activeIndex === undefined && timelineManager.isAtMaxSelections();
  addFireworkButtonEl.disabled = atMaxWithoutEdit;
};

const updateAddFireworkButtonLabel = () => {
  if (!addFireworkButtonEl || !timelineManager) {
    return;
  }
  const activeIndex = timelineManager.getActiveSelectionIndex();
  addFireworkButtonEl.textContent = Number.isFinite(activeIndex)
    ? "この設定で花火を保存"
    : "+ この設定で花火を追加";
};

const hideIntroOverlay = () => {
  if (introOverlayEl) {
    introOverlayEl.classList.add("is-hidden");
  }
};

const hidePreStartUi = () => {
  preStartHideElements = [
    document.getElementById("resetCameraButton"),
    document.querySelector(".control-panel__buttons"),
  ].filter(Boolean);

  preStartHideElements.forEach((el) => el.classList.add("is-hidden-before-start"));
};

const showPreStartUi = () => {
  preStartHideElements.forEach((el) =>
    el.classList.remove("is-hidden-before-start")
  );
};

const restoreUiOpacity = () => {
  [
    document.querySelector(".control-panel__buttons"),
    document.querySelector(".timeline-panel"),
    document.getElementById("resetCameraButton"),
  ]
    .filter(Boolean)
    .forEach((el) => {
      el.style.opacity = "1";
    });
};

const initPostIntroLoading = () => {
  postIntroLoadingEl = document.getElementById("postIntroLoading");
  postIntroLoadingBarEl = document.getElementById("postIntroLoadingBar");

  if (postIntroLoadingBarEl) {
    postIntroLoadingBarEl.style.width = "0%";
  }
};

const hidePostIntroLoading = () => {
  if (postIntroLoadingAnimationId) {
    cancelAnimationFrame(postIntroLoadingAnimationId);
    postIntroLoadingAnimationId = undefined;
  }

  if (postIntroLoadingBarEl) {
    postIntroLoadingBarEl.style.width = "100%";
  }

  if (postIntroLoadingEl) {
    postIntroLoadingEl.classList.remove("is-visible");
  }
};

const showPostIntroLoading = () => {
  if (!postIntroLoadingEl || !postIntroLoadingBarEl) {
    return;
  }

  postIntroLoadingEl.classList.add("is-visible");
  postIntroLoadingBarEl.style.width = "0%";

  const durationMs = 5000;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - start) / durationMs, 1);
    postIntroLoadingBarEl.style.width = `${Math.round(progress * 100)}%`;
    if (progress < 1) {
      postIntroLoadingAnimationId = requestAnimationFrame(tick);
    }
  };

  postIntroLoadingAnimationId = requestAnimationFrame(tick);
};

const scheduleInitialFireworksAfterIntro = () => {
  if (initialFireworksStartTimeoutId) {
    window.clearTimeout(initialFireworksStartTimeoutId);
  }
  initialFireworksStartTimeoutId = window.setTimeout(() => {
    initialFireworksStartTimeoutId = undefined;
    startInitialFireworks();
  }, 5000);
};

const markCameraIntroComplete = () => {
  if (hasCameraIntroCompleted) {
    return;
  }
  hasCameraIntroCompleted = true;
  restoreUiOpacity();
  showPostIntroLoading();
  scheduleInitialFireworksAfterIntro();
};

const setupIntroOverlay = () => {
  introOverlayEl = document.getElementById("introOverlay");
  startExperienceButtonEl = document.getElementById("startExperienceButton");

  if (!startExperienceButtonEl) {
    return;
  }

  startExperienceButtonEl.addEventListener("click", () => {
    hasStartedExperience = true;
    hasCameraIntroCompleted = false;
    hideIntroOverlay();
    showPreStartUi();
    if (cameraController) {
      cameraController.flyToDefaultView({ onComplete: markCameraIntroComplete });
    } else {
      markCameraIntroComplete();
    }
  });
};

const updateDeleteButtonVisibility = () => {
  if (!deleteFireworkButtonEl || !timelineManager) {
    return;
  }
  if (timelineManager.isLocked?.()) {
    deleteFireworkButtonEl.style.display = "none";
    return;
  }
  const activeIndex = timelineManager.getActiveSelectionIndex();
  deleteFireworkButtonEl.style.display = Number.isFinite(activeIndex)
    ? ""
    : "none";
};

const updateCancelButtonVisibility = () => {
  if (!cancelFireworkButtonEl || !timelineManager) {
    return;
  }
  if (timelineManager.isLocked?.()) {
    cancelFireworkButtonEl.style.display = "none";
    return;
  }
  const activeIndex = timelineManager.getActiveSelectionIndex();
  cancelFireworkButtonEl.style.display = Number.isFinite(activeIndex)
    ? ""
    : "none";
};

const updateActionButtons = () => {
  updateAddFireworkButtonState();
  updateAddFireworkButtonLabel();
  updateDeleteButtonVisibility();
  updateCancelButtonVisibility();
};

// === 初期化 ===

const initializeApp = async () => {
  // オーディオの初期化
  primeAudioOnInteraction();

  // Viewerの初期化
  const { viewer, scene } = await initViewer();

  // モデルの読み込み
  loadAllModels(category);

  // Bloomエフェクトのセットアップ
  setupBloom();

  // モデルマトリックスの作成
  const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(location.lng, location.lat)
  );

  // FireworkManagerの初期化
  fireworkManager = new FireworkManager({
    scene,
    params,
    fireWorkCategory: {},
    modelMatrix,
    modelPositions: modelPositionStore.getHeartPositions(),
  });

  // RandomFireworksManagerの初期化
  randomFireworksManager = new RandomFireworksManager({
    fireworkManager,
    modelPositionStore,
    resetFireworkAudioState,
    handleFireworkAudio,
  });

  // カメラコントローラーの初期化
  cameraController = new CameraController(viewer);
  const resetCameraButton = document.getElementById("resetCameraButton");
  cameraController.setResetCameraButton(resetCameraButton);
  setupIntroOverlay();
  hidePreStartUi();
  initPostIntroLoading();

  // デバッグモードでなければ日本全体ビューから開始する
  if (!isDebugMode) {
    cameraController.setJapanView();
    cameraController.setResetButtonVisible(true);
  }

  // 建物ハイライターの初期化
  buildingHighlighter = new BuildingHighlighter(
    scene,
    params.buildingHoverColor
  );

  // タイムラインマネージャーの初期化
  timelineManager = new TimelineManager({
    scene,
    fireworkManager,
    modelPositionStore,
    resetFireworkAudioState,
    handleFireworkAudio,
    onPlaybackStart: () => {
      updateBuildingAppearance({
        buildingColor: params.buildingColor,
        buildingOpacity: DIMMED_BUILDING_OPACITY,
      });
    },
    onPlaybackStop: () => {
      updateBuildingAppearance({
        buildingColor: params.buildingColor,
        buildingOpacity: params.buildingOpacity,
      });
    },
    onRandomFireworkStart: () => {
      randomFireworksManager.setAnimationEnabled(true);
      randomFireworksManager.setVisibility(true);
      randomFireworksManager.startIdleLoop();
    },
    onRandomFireworkStop: () => {
      randomFireworksManager.setAnimationEnabled(false);
      randomFireworksManager.stopIdleLoop();
      randomFireworksManager.setVisibility(false);
    },
  });

  timelineManager.setElements({
    timelinePanel: document.querySelector(".timeline-panel"),
    timelineCarousel: document.getElementById("timelineCarousel"),
    timelineClearButton: document.getElementById("timelineClearButton"),
    timelinePlayButton: document.querySelector(".timeline-play"),
    addFireworkButton: document.getElementById("addFireworkButton"),
  });

  const timelinePanel = document.querySelector(".timeline-panel");
  if (timelinePanel) {
    timelinePanel.addEventListener("timeline:interaction-toggle", () => {
      updateActionButtons();
    });
  }

  // サイドバーコントローラーの初期化
  sidebarController = new SidebarController({
    fireworks: randomFireworksManager.getFireworks(),
    onHeightChange: (height) => {
      // 高さ変更は今後生成される花火にのみ反映する
      if (fireworkManager?.params) {
        fireworkManager.params.height = height;
      }
    },
  });
  sidebarController.initialize();

  // コントロールパネルのセットアップ
  setupControlPanel(viewer);

  // マウスイベントのセットアップ
  setupMouseEvents(scene);

  // 建物タイルセットの読み込み
  loadBuildingTilesets(scene, params);

  // フォールバックタイマー
  fireworksFallbackTimeoutId = window.setTimeout(startInitialFireworks, 8000);

  // 花火追加ボタンのセットアップ
  setupAddFireworkButton();
  setupCancelFireworkButton();

  // 削除ボタンのセットアップ
  setupDeleteFireworkButton();

  // 初期花火ビューを設定（デバッグ時のみ近景から開始）
  if (isDebugMode) {
    cameraController.setInitialView();
  }

  // アニメーションループ開始
  animate();
};

/**
 * コントロールパネルのセットアップ
 */
const setupControlPanel = (viewer) => {
  const controlPanelButtons = document.querySelector(".control-panel__buttons");
  const openButton = controlPanelButtons?.querySelector(".open__button");

  if (controlPanelButtons) {
    // フルスクリーンボタンの移動
    moveFullscreenButton(controlPanelButtons, openButton);

    // オーディオトグルボタンの追加
    createAudioToggleButton(controlPanelButtons, openButton);
  }
};

/**
 * マウスイベントのセットアップ
 */
const setupMouseEvents = (scene) => {
  const screenSpaceHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  // マウス移動時のハイライト
  screenSpaceHandler.setInputAction((movement) => {
    if (!movement.endPosition) {
      return;
    }

    const pickedFeature = scene.pick(movement.endPosition);

    if (
      buildingHighlighter.highlightState?.feature &&
      buildingHighlighter.highlightState.feature !== pickedFeature
    ) {
      buildingHighlighter.clear();
    }

    if (pickedFeature && pickedFeature instanceof Cesium.Cesium3DTileFeature) {
      buildingHighlighter.highlight(pickedFeature);
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // クリック時の建物選択
  screenSpaceHandler.setInputAction((click) => {
    const pickedFeature = scene.pick(click.position);

    if (
      !pickedFeature ||
      !(pickedFeature instanceof Cesium.Cesium3DTileFeature)
    ) {
      return;
    }

    cameraController.flyToBuildingRoof(click.position, () => {
      buildingHighlighter.clear();
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
};

/**
 * 初期花火を開始
 */
const startInitialFireworks = () => {
  if (!hasStartedExperience) {
    return;
  }

  if (!hasCameraIntroCompleted) {
    return;
  }

  if (fireworksInitialized) {
    return;
  }

  if (fireworksFallbackTimeoutId) {
    window.clearTimeout(fireworksFallbackTimeoutId);
    fireworksFallbackTimeoutId = undefined;
  }

  if (initialFireworksStartTimeoutId) {
    window.clearTimeout(initialFireworksStartTimeoutId);
    initialFireworksStartTimeoutId = undefined;
  }

  hidePostIntroLoading();
  randomFireworksManager.startInitialFireworks();
  fireworksInitialized = true;
};

/**
 * 花火追加ボタンのセットアップ
 */
const setupAddFireworkButton = () => {
  const addFireworkButton = document.getElementById("addFireworkButton");
  if (!addFireworkButton) {
    return;
  }

  addFireworkButtonEl = addFireworkButton;

  const parent = addFireworkButton.parentElement;
  if (parent) {
    fireworkActionContainer =
      parent.querySelector(".firework-action-buttons") ||
      document.createElement("div");
    fireworkActionContainer.className = "firework-action-buttons";
    if (!parent.querySelector(".firework-action-buttons")) {
      parent.insertBefore(fireworkActionContainer, addFireworkButton);
    }
    fireworkActionContainer.appendChild(addFireworkButton);
  }

  addFireworkButton.addEventListener("click", () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();

    if (activeIndex === undefined && timelineManager.isAtMaxSelections()) {
      return;
    }

    const selection = sidebarController.createSelection();

    if (Number.isFinite(activeIndex)) {
      const updated = timelineManager.updateSelection(activeIndex, selection);
      if (updated) {
        timelineManager.clearActiveSelection();
      }
    } else {
      timelineManager.addSelection(selection);
    }

    updateActionButtons();
  });

  const timelineCarousel = document.getElementById("timelineCarousel");
  if (timelineCarousel) {
    timelineCarousel.addEventListener("click", () => {
      updateActionButtons();
    });
  }

  updateActionButtons();
};

/**
 * キャンセルボタンのセットアップ
 */
const setupCancelFireworkButton = () => {
  const addFireworkButton = document.getElementById("addFireworkButton");
  if (!addFireworkButton) {
    return;
  }

  const cancelFireworkButton = document.createElement("button");
  cancelFireworkButton.id = "cancelFireworkButton";
  cancelFireworkButton.type = "button";
  cancelFireworkButton.className = "panel-cta panel-cta--ghost";
  cancelFireworkButton.textContent = "キャンセル";
  cancelFireworkButton.style.display = "none";

  cancelFireworkButtonEl = cancelFireworkButton;

  if (fireworkActionContainer) {
    fireworkActionContainer.appendChild(cancelFireworkButton);
  } else {
    addFireworkButton.insertAdjacentElement("afterend", cancelFireworkButton);
  }

  cancelFireworkButton.addEventListener("click", () => {
    timelineManager.clearActiveSelection();
    updateActionButtons();
  });

  updateActionButtons();
};

/**
 * 削除ボタンのセットアップ
 */
const setupDeleteFireworkButton = () => {
  const addFireworkButton = document.getElementById("addFireworkButton");
  if (!addFireworkButton) {
    return;
  }

  const deleteFireworkButton = document.createElement("button");
  deleteFireworkButton.id = "deleteFireworkButton";
  deleteFireworkButton.type = "button";
  deleteFireworkButton.className = "panel-cta panel-cta--danger";
  deleteFireworkButton.innerHTML =
    '<span class="material-icons-outlined" aria-hidden="true">delete</span><span>この設定を削除</span>';
  deleteFireworkButton.style.display = "none";

  deleteFireworkButtonEl = deleteFireworkButton;

  if (fireworkActionContainer) {
    fireworkActionContainer.appendChild(deleteFireworkButton);
  } else {
    addFireworkButton.insertAdjacentElement("afterend", deleteFireworkButton);
  }

  deleteFireworkButton.addEventListener("click", () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();
    if (!Number.isFinite(activeIndex)) {
      return;
    }

    timelineManager.deleteSelection(activeIndex);
    updateActionButtons();
  });

  updateActionButtons();
};

/**
 * アニメーションループ
 */
const animate = () => {
  randomFireworksManager.animate();
  // timelineManagerのアニメーションはplayButton押下時に開始され、
  // FireworkManager内部のrequestAnimationFrameで継続される
};

// アプリケーション起動
initializeApp().catch((error) => {
  console.error("Failed to initialize application:", error);
});
