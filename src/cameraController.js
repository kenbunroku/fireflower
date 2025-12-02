/**
 * Camera Controller Module
 * カメラ操作とビュー設定
 */

import * as Cesium from "cesium";
import { location, roofViewOffsetMeters } from "./constant.js";

// スクラッチ変数（メモリ効率化）
const roofCartographicScratch = new Cesium.Cartographic();
const roofPositionScratch = new Cesium.Cartesian3();
const cameraDirectionScratch = new Cesium.Cartesian3();
const surfaceNormalScratch = new Cesium.Cartesian3();
const cameraRightScratch = new Cesium.Cartesian3();
const cameraUpScratch = new Cesium.Cartesian3();

// 初期ビュー設定
const initialViewHeading = Cesium.Math.toRadians(200);
const initialViewPitch = Cesium.Math.toRadians(-20);
const initialViewRange = 2000.0;

const defaultFireworksOffset = new Cesium.HeadingPitchRange(
  initialViewHeading,
  initialViewPitch,
  initialViewRange
);

// 花火の焦点位置
const fireworksFocus = Cesium.Cartesian3.fromDegrees(
  location.lng,
  location.lat,
  location.height
);

// ENU逆行列
const fireworksEnuInverse = Cesium.Matrix4.inverseTransformation(
  Cesium.Transforms.eastNorthUpToFixedFrame(
    fireworksFocus,
    Cesium.Ellipsoid.WGS84,
    new Cesium.Matrix4()
  ),
  new Cesium.Matrix4()
);

// 日本全体のビュー（デバッグモード用）
const initialJapanView = {
  destination: Cesium.Cartesian3.fromDegrees(138.0, 37.0, 4500000.0),
  orientation: {
    heading: 0.0,
    pitch: -Cesium.Math.PI_OVER_TWO,
    roll: 0.0,
  },
};

/**
 * カメラコントローラークラス
 */
export class CameraController {
  constructor(viewer) {
    this.viewer = viewer;
    this.resetCameraButton = null;
    this.onResetCameraVisibilityChange = null;
  }

  /**
   * リセットカメラボタンを設定
   */
  setResetCameraButton(button, onVisibilityChange = null) {
    this.resetCameraButton = button;
    this.onResetCameraVisibilityChange = onVisibilityChange;

    if (button) {
      button.addEventListener("click", () => this.resetToDefaultView());
      this.setResetButtonVisible(false);
    }
  }

  /**
   * リセットボタンの表示状態を設定
   */
  setResetButtonVisible(isVisible) {
    if (this.resetCameraButton) {
      this.resetCameraButton.style.display = isVisible ? "flex" : "none";
    }
    if (this.onResetCameraVisibilityChange) {
      this.onResetCameraVisibilityChange(isVisible);
    }
  }

  /**
   * 初期ビューに設定（アニメーションなし）
   */
  setInitialView() {
    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(fireworksFocus, 1.0),
      {
        offset: defaultFireworksOffset,
        duration: 0.0,
        complete: () => {
          this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          this.setResetButtonVisible(false);
        },
      }
    );
  }

  /**
   * 日本全体ビューに設定（デバッグモード用）
   */
  setJapanView() {
    this.viewer.camera.setView(initialJapanView);
  }

  /**
   * デフォルトの花火ビューにフライ
   */
  flyToDefaultView(duration = 2.0) {
    this.viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(fireworksFocus, 1.0),
      {
        offset: defaultFireworksOffset,
        duration,
        complete: () => {
          this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          this.setResetButtonVisible(false);
        },
      }
    );
  }

  /**
   * デフォルトビューにリセット
   */
  resetToDefaultView() {
    this.viewer.camera.cancelFlight();
    this.setResetButtonVisible(false);
    this.flyToDefaultView();
  }

  /**
   * 建物の屋上にカメラを移動
   */
  flyToBuildingRoof(screenPosition, onComplete = null) {
    const scene = this.viewer.scene;

    if (!scene.pickPositionSupported) {
      return;
    }

    const pickedPosition = scene.pickPosition(screenPosition);
    if (!Cesium.defined(pickedPosition)) {
      return;
    }

    // 屋上位置を計算
    Cesium.Cartographic.fromCartesian(
      pickedPosition,
      Cesium.Ellipsoid.WGS84,
      roofCartographicScratch
    );
    roofCartographicScratch.height += roofViewOffsetMeters;
    Cesium.Cartesian3.fromRadians(
      roofCartographicScratch.longitude,
      roofCartographicScratch.latitude,
      roofCartographicScratch.height,
      Cesium.Ellipsoid.WGS84,
      roofPositionScratch
    );

    // カメラの向きを計算
    Cesium.Cartesian3.subtract(
      fireworksFocus,
      roofPositionScratch,
      cameraDirectionScratch
    );
    Cesium.Cartesian3.normalize(cameraDirectionScratch, cameraDirectionScratch);

    Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(
      roofPositionScratch,
      surfaceNormalScratch
    );
    Cesium.Cartesian3.cross(
      cameraDirectionScratch,
      surfaceNormalScratch,
      cameraRightScratch
    );

    if (Cesium.Cartesian3.magnitudeSquared(cameraRightScratch) === 0.0) {
      Cesium.Cartesian3.clone(scene.camera.right, cameraRightScratch);
    } else {
      Cesium.Cartesian3.normalize(cameraRightScratch, cameraRightScratch);
    }

    Cesium.Cartesian3.cross(
      cameraRightScratch,
      cameraDirectionScratch,
      cameraUpScratch
    );
    Cesium.Cartesian3.normalize(cameraUpScratch, cameraUpScratch);

    const destination = Cesium.Cartesian3.clone(
      roofPositionScratch,
      new Cesium.Cartesian3()
    );
    const direction = Cesium.Cartesian3.clone(
      cameraDirectionScratch,
      new Cesium.Cartesian3()
    );
    const up = Cesium.Cartesian3.clone(
      cameraUpScratch,
      new Cesium.Cartesian3()
    );
    const fireworksOffset = Cesium.Matrix4.multiplyByPoint(
      fireworksEnuInverse,
      destination,
      new Cesium.Cartesian3()
    );

    this.viewer.camera.flyTo({
      destination,
      orientation: { direction, up },
      duration: 2.0,
      complete: () => {
        this.viewer.camera.lookAt(fireworksFocus, fireworksOffset);
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        this.setResetButtonVisible(true);
        if (onComplete) {
          onComplete();
        }
      },
    });
  }
}

export const getFireworksFocus = () => fireworksFocus;
export const getFireworksEnuInverse = () => fireworksEnuInverse;
