/**
 * Main Entry Point
 * 全モジュールの統合とアプリケーション初期化
 */

import * as Cesium from "cesium";

// モジュールのインポート
import FireworkManager from "./FireworkManager.js";
import { category, isDebugMode, location, params } from "./constant.js";

import {
  primeAudioOnInteraction,
  createAudioToggleButton,
  handleFireworkAudio,
  resetFireworkAudioState,
} from "./audio.js";

import { loadAllModels, modelPositionStore } from "./modelLoader.js";

import {
  initViewer,
  setupBloom,
  moveFullscreenButton,
  getViewer,
  getScene,
} from "./viewer.js";

import {
  loadBuildingTilesets,
  BuildingHighlighter,
  updateBuildingAppearance,
} from "./buildingTileset.js";

import { CameraController } from "./cameraController.js";

import { TimelineManager } from "./timeline.js";

import { SidebarController } from "./sidebarControls.js";

import { RandomFireworksManager } from "./randomFireworks.js";

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

  // デバッグモードでなければ日本全体ビューを設定（元のコードと同じ）
  if (!isDebugMode) {
    cameraController.setJapanView();
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

  // サイドバーコントローラーの初期化
  sidebarController = new SidebarController({
    fireworks: randomFireworksManager.getFireworks(),
    onHeightChange: (height) => {
      randomFireworksManager.getFireworks().forEach((firework) => {
        if (firework.appearance?.uniforms) {
          firework.appearance.uniforms.u_launchHeight = height;
        }
      });
    },
  });
  sidebarController.initialize();

  // コントロールパネルのセットアップ
  setupControlPanel(viewer);

  // マウスイベントのセットアップ
  setupMouseEvents(scene);

  // 建物タイルセットの読み込み
  loadBuildingTilesets(scene, params, startInitialFireworks);

  // フォールバックタイマー
  fireworksFallbackTimeoutId = window.setTimeout(startInitialFireworks, 8000);

  // 花火追加ボタンのセットアップ
  setupAddFireworkButton();

  // 削除ボタンのセットアップ
  setupDeleteFireworkButton();

  // 初期花火ビューを設定（元のコードのsetInitialFireworksViewと同じ）
  cameraController.setInitialView();

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
  if (fireworksInitialized) {
    return;
  }

  if (fireworksFallbackTimeoutId) {
    window.clearTimeout(fireworksFallbackTimeoutId);
    fireworksFallbackTimeoutId = undefined;
  }

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

  const updateButtonState = () => {
    addFireworkButton.disabled = timelineManager.isAtMaxSelections();
  };

  const updateButtonLabel = () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();
    addFireworkButton.textContent = Number.isFinite(activeIndex)
      ? "この設定で保存"
      : "+ この設定で花火を追加";
  };

  addFireworkButton.addEventListener("click", () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();

    if (activeIndex === undefined && timelineManager.isAtMaxSelections()) {
      return;
    }

    const selection = sidebarController.createSelection();

    if (Number.isFinite(activeIndex)) {
      timelineManager.updateSelection(activeIndex, selection);
    } else {
      timelineManager.addSelection(selection);
    }

    updateButtonState();
    updateButtonLabel();
  });

  updateButtonState();
  updateButtonLabel();
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

  addFireworkButton.insertAdjacentElement("afterend", deleteFireworkButton);

  const updateVisibility = () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();
    deleteFireworkButton.style.display = Number.isFinite(activeIndex)
      ? ""
      : "none";
  };

  deleteFireworkButton.addEventListener("click", () => {
    const activeIndex = timelineManager.getActiveSelectionIndex();
    if (!Number.isFinite(activeIndex)) {
      return;
    }

    timelineManager.deleteSelection(activeIndex);
    updateVisibility();
  });

  updateVisibility();
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
