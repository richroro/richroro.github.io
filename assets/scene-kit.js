/* ══════════════════════════════════════════════════════════════════════════
   scene-kit — 이 사이트의 3D 페이지들이 같이 쓰는 재료

   나비(`/butterfly/`)와 종목 지도(`/stocks/map/`)가 같은 렌더링 위에 선다.
   환경광을 굽는 법, 빛을 번지게 하는 후처리, 배경과 먼지, 작은 수학 도구가
   여기 있다. 페이지마다 다른 것(형상·데이터·조작)은 각자 파일에 둔다.

   three.js 는 저장소에 같이 둔 `/assets/three.min.js` 한 개만 쓴다(CDN 없음).
   ══════════════════════════════════════════════════════════════════════════ */

import * as THREE from './three.min.js';
export { THREE };

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

// 결정적 난수. 씨앗이 같으면 같은 무늬가 나오므로 새로고침해도 나비가 변하지 않는다.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function makeMetalRoughnessMap(seed) {
  const [c, x] = canvas2d(512, 512);
  const rand = rng(seed);
  x.fillStyle = '#808080'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const y = rand() * 512, len = 30 + rand() * 300, v = Math.floor(96 + rand() * 96);
    x.strokeStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.12})`;
    x.lineWidth = 0.6 + rand() * 1.6;
    x.beginPath(); x.moveTo(rand() * 512, y); x.lineTo(rand() * 512 + len, y + (rand() - 0.5) * 6); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* 나비 뒤에 까는 넓은 후광. 중심을 뜨겁게 두지 않는다. */
export function makeHaloTexture() {
  const [c, x] = canvas2d(256, 256);
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.06)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/* 동그란 빛 알갱이 — 먼지와 불티가 같이 쓴다. */
export function makeSpriteTexture() {
  const [c, x] = canvas2d(64, 64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function buildEnvTexture(preset) {
  const W = 256, H = 128;
  const data = new Uint16Array(W * H * 4);
  const half = THREE.DataUtils.toHalfFloat;
  const lights = preset.env.map((l) => {
    const d = new THREE.Vector3(...l.dir).normalize();
    return { d, cosR: Math.cos(l.ang), color: l.color, power: l.power };
  });
  const dir = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const phi = (y + 0.5) / H * Math.PI;               // 0(위) → π(아래)
    const sp = Math.sin(phi), cp = Math.cos(phi);
    for (let x = 0; x < W; x++) {
      const theta = (x + 0.5) / W * TAU;
      dir.set(sp * Math.cos(theta), cp, sp * Math.sin(theta));
      // 하늘 ↔ 바닥 그라데이션
      const t = smooth(-0.35, 0.85, dir.y);
      let r = lerp(preset.ground[0], preset.sky[0], t);
      let g = lerp(preset.ground[1], preset.sky[1], t);
      let b = lerp(preset.ground[2], preset.sky[2], t);
      // 수평선 바로 위의 옅은 띠 — 금속에 긴 반사 선을 남긴다.
      const band = Math.exp(-Math.pow((dir.y - 0.06) / 0.05, 2)) * 0.5;
      r += band * 0.18; g += band * 0.22; b += band * 0.3;
      for (const l of lights) {
        const c = dir.dot(l.d);
        if (c <= l.cosR) continue;
        const k = Math.pow((c - l.cosR) / (1 - l.cosR), 1.6) * l.power;
        r += l.color[0] * k; g += l.color[1] * k; b += l.color[2] * k;
      }
      const i = (y * W + x) * 4;
      data[i] = half(r); data[i + 1] = half(g); data[i + 2] = half(b); data[i + 3] = half(1);
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function buildBackdrop(preset) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(preset.bgTop) },
      uBot: { value: new THREE.Color(preset.bgBot) },
      uHalo: { value: new THREE.Color(preset.halo) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBot, uHalo;
      varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = smoothstep(-0.55, 0.85, d.y);
        vec3 c = mix(uBot, uTop, h);
        c += uHalo * pow(max(0.0, 1.0 - length(d.xy * vec2(0.85, 1.25))), 3.2) * 0.35;  // 아득한 후광
        c += uHalo * 0.25 * pow(max(0.0, dot(d, normalize(vec3(-0.5, 0.45, 0.6)))), 8.0);
        float n = fract(sin(dot(d.xy, vec2(12.9898, 78.233))) * 43758.5453);            // 밴딩 제거
        gl_FragColor = vec4(c + (n - 0.5) * 0.004, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// 나비 뒤에 깔리는 넓은 후광. 늘 카메라를 본다.
export function buildHalo(preset, sprite) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 6.4),
    new THREE.MeshBasicMaterial({
      map: sprite, color: new THREE.Color(preset.halo), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.5,
    }),
  );
  m.renderOrder = -5;
  m.frustumCulled = false;
  return m;
}

const MOTE_VERT = /* glsl */`
  attribute float aSize, aPhase;
  uniform float uTime, uScale;
  varying float vTw;
  void main(){
    vec3 p = position;
    p.x += sin(uTime * 0.17 + aPhase) * 0.22;
    p.y += sin(uTime * 0.11 + aPhase * 1.7) * 0.3 + sin(uTime * 0.05 + aPhase * 0.4) * 0.5;
    p.z += cos(uTime * 0.13 + aPhase * 2.1) * 0.22;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vTw = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase * 6.2);
    gl_PointSize = clamp(aSize * uScale / max(0.2, -mv.z), 1.0, 90.0);
    gl_Position = projectionMatrix * mv;
  }`;
const MOTE_FRAG = /* glsl */`
  uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity;
  varying float vTw;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(uColor * t.a * vTw * 2.0, t.a * vTw * uOpacity);
  }`;

export function buildMotes(preset, sprite, count) {
  const pos = new Float32Array(count * 3), size = new Float32Array(count), phase = new Float32Array(count);
  const rand = rng(4242);
  for (let i = 0; i < count; i++) {
    const r = 1.2 + Math.pow(rand(), 0.55) * 7;
    const th = rand() * TAU, ph = Math.acos(2 * rand() - 1);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = (rand() - 0.5) * 6.5;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    size[i] = 0.006 + Math.pow(rand(), 2.6) * 0.055;
    phase[i] = rand() * TAU;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sprite }, uTime: { value: 0 }, uScale: { value: 300 },
      uColor: { value: new THREE.Color(preset.mote) }, uOpacity: { value: 0.75 },
    },
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return { pts, mat };
}

const FS_VERT = /* glsl */`
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Composer {
  constructor(renderer, levels = 5) {
    this.renderer = renderer;
    this.levels = levels;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const rt = (w, h, samples = 0) => {
      const t = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        depthBuffer: samples > 0, stencilBuffer: false, samples,
      });
      t.texture.generateMipmaps = false;
      return t;
    };
    this._rt = rt;

    this.bright = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uThreshold: { value: 1.0 }, uKnee: { value: 0.6 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform float uThreshold, uKnee;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tSrc, vUv).rgb;
          float l = max(c.r, max(c.g, c.b));
          float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
          soft = soft * soft / (4.0 * uKnee + 1e-4);
          float w = max(soft, l - uThreshold) / max(l, 1e-4);
          gl_FragColor = vec4(c * w, 1.0);
        }`,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tSrc; uniform vec2 uDir;
        varying vec2 vUv;
        void main(){
          vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
          s += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * 0.3162162;
          s += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * 0.0702703;
          gl_FragColor = vec4(s, 1.0);
        }`,
    });
    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tB0: { value: null }, tB1: { value: null },
        tB2: { value: null }, tB3: { value: null }, tB4: { value: null },
        uBloom: { value: 1.0 }, uExposure: { value: 1.0 }, uTime: { value: 0 },
        uGrain: { value: 0.018 }, uVignette: { value: 0.95 }, uCA: { value: 0.0016 },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene, tB0, tB1, tB2, tB3, tB4;
        uniform float uBloom, uExposure, uTime, uGrain, uVignette, uCA;
        uniform vec2 uRes;
        varying vec2 vUv;
        vec3 aces(vec3 x){
          const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }
        vec3 toSRGB(vec3 c){
          return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(0.41666)) - 0.055, step(0.0031308, c));
        }
        void main(){
          vec2 d = vUv - 0.5;
          float r2 = dot(d, d);
          vec2 off = d * uCA * (0.35 + r2 * 3.0);
          vec3 col = vec3(
            texture2D(tScene, vUv + off).r,
            texture2D(tScene, vUv).g,
            texture2D(tScene, vUv - off).b);
          vec3 b = texture2D(tB0, vUv).rgb * 0.34 + texture2D(tB1, vUv).rgb * 0.26
                 + texture2D(tB2, vUv).rgb * 0.19 + texture2D(tB3, vUv).rgb * 0.13
                 + texture2D(tB4, vUv).rgb * 0.08;
          col += b * uBloom;
          col = aces(col * uExposure);
          float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col *= mix(vec3(0.93, 0.975, 1.07), vec3(1.05, 1.0, 0.95), smoothstep(0.12, 0.72, lum));
          col *= 1.0 - uVignette * smoothstep(0.12, 0.78, r2);
          float n = fract(sin(dot(vUv * uRes + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          col += (n - 0.5) * uGrain;
          gl_FragColor = vec4(toSRGB(col), 1.0);
        }`,
    });
  }

  setSize(w, h, samples) {
    this.dispose();
    this.w = Math.max(2, w); this.h = Math.max(2, h);
    this.rtScene = this._rt(this.w, this.h, samples);
    this.chain = [];
    let cw = this.w, ch = this.h;
    for (let i = 0; i < this.levels; i++) {
      cw = Math.max(2, Math.floor(cw / 2)); ch = Math.max(2, Math.floor(ch / 2));
      this.chain.push({ a: this._rt(cw, ch), b: this._rt(cw, ch), w: cw, h: ch });
    }
    this.composite.uniforms.uRes.value.set(this.w, this.h);
  }

  dispose() {
    if (this.rtScene) this.rtScene.dispose();
    if (this.chain) this.chain.forEach((c) => { c.a.dispose(); c.b.dispose(); });
    this.rtScene = null; this.chain = null;
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.clear(true, false, false);
    this.renderer.render(this.scene, this.cam);
  }

  render(scene, camera, o) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(scene, camera);

    if (o.bloom > 0.001) {
      this.bright.uniforms.tSrc.value = this.rtScene.texture;
      this.bright.uniforms.uThreshold.value = o.threshold;
      this.pass(this.bright, this.chain[0].a);
      for (let i = 0; i < this.chain.length; i++) {
        const c = this.chain[i];
        if (i > 0) { this.blur.uniforms.tSrc.value = this.chain[i - 1].a.texture; this.blur.uniforms.uDir.value.set(0.7 / c.w, 0); this.pass(this.blur, c.b); }
        else { this.blur.uniforms.tSrc.value = c.a.texture; this.blur.uniforms.uDir.value.set(1 / c.w, 0); this.pass(this.blur, c.b); }
        this.blur.uniforms.tSrc.value = c.b.texture;
        this.blur.uniforms.uDir.value.set(0, 1 / c.h);
        this.pass(this.blur, c.a);
      }
    }
    const u = this.composite.uniforms;
    u.tScene.value = this.rtScene.texture;
    for (let i = 0; i < 5; i++) u['tB' + i].value = this.chain[Math.min(i, this.chain.length - 1)].a.texture;
    u.uBloom.value = o.bloom;
    u.uExposure.value = o.exposure;
    u.uTime.value = o.time;
    u.uGrain.value = o.grain;
    r.setRenderTarget(null);
    this.pass(this.composite, null);
  }
}

