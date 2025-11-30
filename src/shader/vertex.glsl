in vec3 position3DHigh;
in vec3 position3DLow;
in float batchId;
in float delay;
in vec3 unitDir;
in float baseRadius;

uniform float u_pointSize;
uniform float u_time;
uniform float u_radius;
uniform float u_launchHeight;
uniform float u_launchProgress;
uniform float u_bloomDuration;
uniform float u_gravityStrength;

float easingOutQuint(float t) {
  return 1.0 - pow(1.0 - t, 5.0);
}

void main() {
  vec4 p = czm_translateRelativeToEye(position3DHigh, position3DLow);
  vec3 dir = normalize(unitDir);

  float t = max(u_time - delay, 0.0);
  float d1 = easingOutQuint(t / u_bloomDuration);

  float scaleFactor = d1 * u_radius; // 時間経過で 0 -> u_radius まで増える

  // 移動量 = 方向 * 元の距離 * 拡大したい倍率
  vec3 displacement = unitDir * baseRadius * scaleFactor;

  float grav = 9.8;
  vec3 gravP = vec3(0., 0., -1.) * (t * t * grav) * 0.5 * u_gravityStrength;
  float launchProgress = clamp(u_launchProgress, 0.0, 1.0);
  float launchOffset = u_launchHeight * launchProgress;
  vec3 newP = (p.xyz + displacement) + gravP;
  newP.z += launchOffset;
  p.xyz = newP;

  gl_Position = czm_modelViewProjectionRelativeToEye * vec4(p.xyz, 1.);
  gl_PointSize = u_pointSize * (1. - delay * 2.);
}
