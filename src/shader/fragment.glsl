varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 color = vec3(uv.x, uv.y, 0.0);
  gl_FragColor = vec4(color, 1.0);
}
