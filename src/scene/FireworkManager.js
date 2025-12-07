import * as Cesium from "cesium";
import vs from "../shader/vertex.glsl";
import fs from "../shader/fragment.glsl";

import {
  randomPointOnSphere,
  rotatePositionsAroundZ,
} from "../core/util.js";

export default class FireworkManager {
  constructor({
    scene,
    params,
    fireWorkCategory,
    modelMatrix,
    modelPositions = new Float32Array(),
  }) {
    this.scene = scene;
    this.params = params;
    this.fireWorkCategory = fireWorkCategory;
    this.modelMatrix = modelMatrix;
    this.modelPositions = modelPositions;
    this.vertexShaderSource = vs;
    this.fragmentShaderSource = fs;
    this.fireworks = [];
    this.launchSequences = new Set();
    this.launchOffsetScratch = new Cesium.Cartesian3();
    this.launchTranslationScratch = new Cesium.Matrix4();

    // グループ別のpause状態を管理
    this.groupPauseState = {
      random: {
        isAnimationPaused: false,
        pauseStartedMs: 0,
        accumulatedPauseMs: 0,
      },
      timeline: {
        isAnimationPaused: false,
        pauseStartedMs: 0,
        accumulatedPauseMs: 0,
      },
    };

    // 後方互換性のためのグローバル状態（非推奨）
    this.isAnimationPaused = false;
    this.pauseStartedMs = 0;
    this.accumulatedPauseMs = 0;
  }

  setModelPositions(positions) {
    this.modelPositions = positions || new Float32Array();
  }

  getFireworks() {
    return this.fireworks;
  }

  getPrimaryAppearance() {
    return this.fireworks[0]?.appearance;
  }

  _createFireworkMaterial() {
    return new Cesium.MaterialAppearance({
      translucent: true,
      closed: false,
      vertexShaderSource: this.vertexShaderSource,
      fragmentShaderSource: this.fragmentShaderSource,
      materialCacheKey: "simple-points",
      renderState: {
        depthMask: true,
        blending: Cesium.BlendingState.ADDITIVE_BLEND,
      },
    });
  }

  createFirework(options = {}) {
    const {
      numberOfParticles = options.numberOfParticles ??
        this.params.numberOfParticles,
      times = options.times ?? this.params.times,
      pointSize = options.pointSize ?? this.params.pointSize,
      radius = options.radius ?? this.params.radius,
      fireworkColor = options.fireworkColor ?? this.params.fireworkColor,
      launchDuration = this.params.launchDuration,
      bloomDuration = this.params.bloomDuration,
      launchHeight = this.params.height,
      delayStep = this.params.delay,
      gravityStrentgh = this.params.gravityStrength,
      useEaseInSine = false,
      matrix = this.modelMatrix,
      modelPositions: incomingModelPositions = options.modelPositions,
      randomizeModelRotation = false,
      group = "random", // デフォルトは"random"グループ
    } = options;

    let modelPositions = incomingModelPositions;
    if (incomingModelPositions && randomizeModelRotation) {
      const randomAngle = Math.random() * Math.PI * 2;
      modelPositions = rotatePositionsAroundZ(
        incomingModelPositions,
        randomAngle
      );
    }

    const positions = new Float32Array(numberOfParticles * 3 * times);
    const delays = new Float32Array(numberOfParticles * times);
    const unitDirs = new Float32Array(numberOfParticles * 3 * times);
    const baseRadii = new Float32Array(numberOfParticles * times);

    let point;

    for (let i = 0; i < numberOfParticles; i++) {
      if (modelPositions) {
        const baseIndex = i * 3;
        point = {
          x: modelPositions[baseIndex],
          y: modelPositions[baseIndex + 1],
          z: modelPositions[baseIndex + 2],
        };
      } else {
        point = randomPointOnSphere(0.1);
      }

      const len = Math.hypot(point.x, point.y, point.z) || 1.0;
      const ux = point.x / len;
      const uy = point.y / len;
      const uz = point.z / len;

      for (let j = 0; j < times; j++) {
        const idx3 = (i * times + j) * 3;
        const idx1 = i * times + j;

        positions[idx3 + 0] = point.x;
        positions[idx3 + 1] = point.y;
        positions[idx3 + 2] = point.z;

        unitDirs[idx3 + 0] = ux;
        unitDirs[idx3 + 1] = uy;
        unitDirs[idx3 + 2] = uz;

        delays[idx1] = j * delayStep;

        baseRadii[idx1] = len;
      }
    }

    const geometry = new Cesium.Geometry({
      attributes: {
        position: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.DOUBLE,
          componentsPerAttribute: 3,
          values: positions,
        }),
        delay: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: delays,
        }),
        unitDir: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 3,
          values: unitDirs,
        }),
        baseRadius: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 1,
          values: baseRadii,
        }),
      },
      primitiveType: Cesium.PrimitiveType.POINTS,
      boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    });

    const appearance = this._createFireworkMaterial();
    appearance.uniforms = {
      u_color: Cesium.Color.fromCssColorString(
        fireworkColor,
        new Cesium.Color()
      ),
      u_pointSize: pointSize,
      u_time: 0.0,
      u_radius: radius,
      u_duration: launchDuration,
      u_launchHeight: launchHeight,
      u_bloomDuration: bloomDuration,
      u_launchProgress: 0.0,
      u_gravityStrength: gravityStrentgh,
      u_useEaseInSine: useEaseInSine ? 1.0 : 0.0,
    };

    const instance = new Cesium.GeometryInstance({ geometry });
    const primitive = new Cesium.Primitive({
      geometryInstances: instance,
      appearance,
      asynchronous: false,
      modelMatrix: matrix,
    });
    primitive.cull = false;
    this.scene.primitives.add(primitive);

    const firework = {
      primitive,
      appearance,
      startTime: undefined,
      group, // グループを保存
    };
    return firework;
  }

  createRandomizedLaunchMatrix(
    baseMatrix = this.modelMatrix,
    spreadMeters = this.params.launchOffsetRangeMeters
  ) {
    const offsetX = (Math.random() - 0.5) * 2.0 * spreadMeters;
    const offsetY = (Math.random() - 0.5) * 2.0 * spreadMeters;
    Cesium.Cartesian3.fromElements(
      offsetX,
      offsetY,
      0.0,
      this.launchOffsetScratch
    );
    Cesium.Matrix4.fromTranslation(
      this.launchOffsetScratch,
      this.launchTranslationScratch
    );
    return Cesium.Matrix4.multiply(
      baseMatrix,
      this.launchTranslationScratch,
      new Cesium.Matrix4()
    );
  }

  stopLaunchSequence(sequence) {
    if (!sequence) {
      return;
    }
    sequence.active = false;
    if (sequence.timeoutId) {
      window.clearTimeout(sequence.timeoutId);
    }
    this.launchSequences.delete(sequence);
  }

  stopAllLaunchSequences() {
    Array.from(this.launchSequences).forEach((sequence) => {
      this.stopLaunchSequence(sequence);
    });
  }

  // グループ指定でpause
  pauseAnimationForGroup(groupName) {
    const state = this.groupPauseState[groupName];
    if (!state || state.isAnimationPaused) {
      return;
    }
    state.isAnimationPaused = true;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    state.pauseStartedMs = now;
  }

  // グループ指定でresume
  resumeAnimationForGroup(groupName) {
    const state = this.groupPauseState[groupName];
    if (!state || !state.isAnimationPaused) {
      return;
    }
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (state.pauseStartedMs) {
      state.accumulatedPauseMs += now - state.pauseStartedMs;
    }
    state.pauseStartedMs = 0;
    state.isAnimationPaused = false;
  }

  // グループのpause状態をリセット
  resetPauseStateForGroup(groupName) {
    const state = this.groupPauseState[groupName];
    if (!state) {
      return;
    }
    state.isAnimationPaused = false;
    state.pauseStartedMs = 0;
    state.accumulatedPauseMs = 0;
  }

  // 後方互換性: グローバルpause（全グループに影響）
  pauseAnimation() {
    if (this.isAnimationPaused) {
      return;
    }
    this.isAnimationPaused = true;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.pauseStartedMs = now;

    // 全グループをpause
    Object.keys(this.groupPauseState).forEach((groupName) => {
      this.pauseAnimationForGroup(groupName);
    });
  }

  // 後方互換性: グローバルresume（全グループに影響）
  resumeAnimation() {
    if (!this.isAnimationPaused) {
      return;
    }
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (this.pauseStartedMs) {
      this.accumulatedPauseMs += now - this.pauseStartedMs;
    }
    this.pauseStartedMs = 0;
    this.isAnimationPaused = false;

    // 全グループをresume
    Object.keys(this.groupPauseState).forEach((groupName) => {
      this.resumeAnimationForGroup(groupName);
    });
  }

  toggleAnimationPause() {
    if (this.isAnimationPaused) {
      this.resumeAnimation();
    } else {
      this.pauseAnimation();
    }
  }

  // グループ別のpausedOffsetMsを取得
  _getPausedOffsetForGroup(groupName, nowMs) {
    const state = this.groupPauseState[groupName];
    if (!state) {
      // グループが存在しない場合はグローバル状態を使用
      return (
        this.accumulatedPauseMs +
        (this.isAnimationPaused && this.pauseStartedMs
          ? Math.max(nowMs - this.pauseStartedMs, 0)
          : 0)
      );
    }
    return (
      state.accumulatedPauseMs +
      (state.isAnimationPaused && state.pauseStartedMs
        ? Math.max(nowMs - state.pauseStartedMs, 0)
        : 0)
    );
  }

  animate(fireworkArray, timestamp, onUpdate) {
    const nowMs =
      typeof timestamp === "number"
        ? timestamp
        : typeof performance !== "undefined"
        ? performance.now()
        : Date.now();

    fireworkArray.forEach((firework) => {
      if (firework?.primitive && firework.primitive.show === false) {
        return;
      }

      // 花火のグループを取得（デフォルトは"random"）
      const groupName = firework.group || "random";
      const pausedOffsetMs = this._getPausedOffsetForGroup(groupName, nowMs);

      if (!firework.startTime) {
        firework.startTime = nowMs;
        firework.pauseOffsetAtStart = pausedOffsetMs;
      }
      const uniforms = firework.appearance?.uniforms;
      if (!uniforms) {
        return;
      }
      const startDelayMs = Math.max(firework.startDelayMs || 0, 0);
      const accumulatedPauseForFirework = Math.max(
        pausedOffsetMs - (firework.pauseOffsetAtStart || 0),
        0
      );
      const elapsedMs = Math.max(
        nowMs - firework.startTime - startDelayMs - accumulatedPauseForFirework,
        0
      );
      const elapsedSeconds = elapsedMs * 0.001;
      const launchDuration = Math.max(
        uniforms.u_duration || this.params.launchDuration,
        1e-6
      );
      const launchProgress = Math.min(elapsedSeconds / launchDuration, 1.0);
      uniforms.u_launchProgress = launchProgress;
      const explosionTime = Math.max(elapsedSeconds - launchDuration, 0.0);
      uniforms.u_time = explosionTime;

      if (typeof onUpdate === "function") {
        const bloomDuration = Math.max(
          uniforms.u_bloomDuration || this.params.bloomDuration,
          1e-6
        );
        const hasStarted =
          nowMs - firework.startTime - accumulatedPauseForFirework >=
          startDelayMs;
        const stage = !hasStarted
          ? "pending"
          : launchProgress < 1.0
          ? "launch"
          : explosionTime <= bloomDuration
          ? "bloom"
          : "cooldown";
        onUpdate({
          firework,
          nowMs,
          stage,
          hasStarted,
          launchProgress,
          explosionTime,
          launchDuration,
          bloomDuration,
          startDelayMs,
          elapsedMs,
        });
      }
    });
    requestAnimationFrame((ts) => this.animate(fireworkArray, ts, onUpdate));
  }
}
