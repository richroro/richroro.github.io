// 디지털 휴먼 — 실시간 3D 인물.
// 빌드: README.md 참고 (esbuild 로 ../app.js 한 파일로 묶는다)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderChunk } from 'three';

const $ = s => document.querySelector(s);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = x => clamp(x, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };

// 부드러운 1D 값 노이즈. 시드마다 다른 곡선을 준다.
function makeNoise(seed) {
  const p = new Float32Array(256);
  let s = seed * 7919 + 1;
  for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; p[i] = (s / 2147483647) * 2 - 1; }
  const n = t => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(p[i & 255], p[(i + 1) & 255], u); };
  return t => n(t) * 0.6 + n(t * 2.13 + 17.3) * 0.28 + n(t * 4.71 + 31.7) * 0.12;
}
const NZ = Array.from({ length: 12 }, (_, i) => makeNoise(i + 3));

// ───────────────────────── 렌더러 · 씬 ─────────────────────────
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

// 단위는 cm. 인물은 +Z 를 바라보고 서 있다(키 174cm).
const camera = new THREE.PerspectiveCamera(17, 1, 5, 2000);
const LOOK = new THREE.Vector3(0, 151, 0);
const CAM_BASE = new THREE.Vector3(0, 156, 215);

// 배경: 조명과 무관한 부드러운 그라디언트 + 아주 옅은 얼룩
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(900, 600),
  new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { cA: { value: new THREE.Color('#5d5650') }, cB: { value: new THREE.Color('#141312') } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform vec3 cA; uniform vec3 cB;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 p = vUv - vec2(0.43, 0.58); p.x *= 1.5;
        float d = length(p);
        vec3 c = mix(cA, cB, smoothstep(0.0, 0.62, d));
        c += (h(floor(vUv*900.0)) - 0.5) * 0.006;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
backdrop.position.set(0, 150, -230);
backdrop.renderOrder = -1;
scene.add(backdrop);

// 조명: 따뜻한 키 라이트(그림자), 차가운 필, 뒤쪽 림 두 개
const key = new THREE.DirectionalLight(0xfff0e2, 2.3);
key.position.set(-70, 215, 130);
key.target.position.copy(LOOK).add(new THREE.Vector3(0, 6, 0));
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 50, far: 450 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.25;
key.shadow.radius = 7;
key.shadow.blurSamples = 16;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xe4ebff, 0.8);
fill.position.set(110, 150, 110);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffe6d0, 2.2);
rim.position.set(90, 200, -140);
rim.target.position.copy(LOOK);
scene.add(rim, rim.target);

const rim2 = new THREE.DirectionalLight(0xe8e6f0, 0.7);
rim2.position.set(-110, 185, -110);
rim2.target.position.copy(LOOK);
scene.add(rim2, rim2.target);

scene.add(new THREE.HemisphereLight(0xfff4ea, 0x2a2420, 0.25));

// ───────────────────────── 후처리 ─────────────────────────
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const film = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
    grain: { value: 0.045 }, vignette: { value: 0.9 }, ca: { value: 0.0018 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, grain, vignette, ca; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * ca * (0.4 + r2 * 4.0);
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= mix(1.0, smoothstep(0.75, 0.05, r2 * 1.6), vignette * 0.55);
      float n = hash(vUv * res + fract(time * 7.123) * 811.0) + hash(vUv * res * 0.5 + fract(time * 3.7) * 97.0) - 1.0;
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += n * grain * (0.35 + 0.65 * (1.0 - l));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
composer.addPass(film);

// ───────────────────────── 피부 셰이더 ─────────────────────────
// 직접광 디퓨즈를 채널별로 감싸서(wrap) 명암 경계에 붉은 산란광이 번지게 한다.
const SSS_FROM = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
const SSS_TO = `{
    float nlRaw = dot( geometryNormal, directLight.direction );
    vec3 wrapNL = clamp( ( vec3( nlRaw ) + SKIN_WRAP ) / ( 1.0 + SKIN_WRAP ), 0.0, 1.0 );
    wrapNL *= mix( vec3( 1.0 ), vec3( 1.0, 0.86, 0.80 ), smoothstep( 0.6, 0.0, nlRaw ) );
    reflectedLight.directDiffuse += wrapNL * directLight.color * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
  }`;
function skinify(mat, wrap) {
  mat.onBeforeCompile = sh => {
    const chunk = ShaderChunk.lights_physical_pars_fragment;
    if (!chunk.includes(SSS_FROM)) return; // three 버전이 바뀌면 그냥 기본 셰이딩
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
      `#define SKIN_WRAP vec3(${wrap.join(',')})\n` + chunk.replace(SSS_FROM, SSS_TO));
  };
  mat.customProgramCacheKey = () => 'skin' + wrap.join();
}

// ───────────────────────── 인물 불러오기 ─────────────────────────
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => { $('#loadbar').style.width = (loaded / total * 100).toFixed(0) + '%'; };
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
const tex = (name, srgb = false) => {
  const t = texLoader.load('assets/' + name);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
};
const T = {
  headColor: tex('head_color.jpg', true), headNormal: tex('head_normal.jpg'), headRough: tex('head_rough.jpg'),
  bodyColor: tex('body_color.jpg', true), bodyNormal: tex('body_normal.jpg'), hair: tex('hair.webp', true),
};

const M = {
  face: new THREE.MeshPhysicalMaterial({
    map: T.headColor, normalMap: T.headNormal, roughnessMap: T.headRough, roughness: 1,
    specularIntensity: 0.55, sheen: 0.35, sheenColor: new THREE.Color(0.9, 0.55, 0.45), sheenRoughness: 0.55,
    clearcoat: 0.06, clearcoatRoughness: 0.42,
  }),
  eyes: new THREE.MeshPhysicalMaterial({
    map: T.headColor, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.025, specularIntensity: 0.4,
  }),
  hair: new THREE.MeshPhysicalMaterial({
    map: T.hair, alphaTest: 0.42, alphaToCoverage: true, side: THREE.DoubleSide,
    roughness: 0.5, specularIntensity: 0.45, sheen: 0.12, sheenColor: new THREE.Color(0.3, 0.26, 0.24), sheenRoughness: 0.4,
  }),
  body: new THREE.MeshPhysicalMaterial({
    map: T.bodyColor, normalMap: T.bodyNormal, roughness: 0.78, sheen: 0.2, sheenColor: new THREE.Color(0.8, 0.55, 0.48), sheenRoughness: 0.6,
  }),
};
M.headskin = M.face.clone();
M.headskin.sheen = 0.12;
M.headskin.clearcoat = 0;
M.headskin.roughness = 1.3;
M.hair.color.setRGB(1.2, 1.15, 1.1);
M.lashes = M.hair;
skinify(M.face, [0.5, 0.24, 0.16]);
skinify(M.headskin, [0.5, 0.24, 0.16]);
skinify(M.body, [0.4, 0.2, 0.14]);

const rig = { ready: false };
const gltfLoader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
gltfLoader.load('assets/avatar.glb', gltf => {
  const root = gltf.scene;
  const faces = []; // 얼굴(피부·눈·속눈썹) 프리미티브는 같은 모프를 공유한다
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(m => M[m.name] || m) : (M[o.material.name] || o.material);
    if (o.morphTargetDictionary && o.morphTargetDictionary.eyeBlinkLeft !== undefined) faces.push(o);
  });
  scene.add(root);
  rig.root = root;
  const bone = n => root.getObjectByName('Bip01_' + n);
  Object.assign(rig, {
    spine1: bone('Spine1'), spine2: bone('Spine2'), neck: bone('Neck'), head: bone('Head'),
    lEye: bone('LEye'), rEye: bone('REye'), lClav: bone('L_Clavicle'), rClav: bone('R_Clavicle'),
  });
  poseArms(root, bone);
  root.updateMatrixWorld(true);
  for (const b of ['spine1', 'spine2', 'neck', 'head', 'lEye', 'rEye', 'lClav', 'rClav']) {
    rig[b].userData.rest = rig[b].quaternion.clone();
    rig[b].userData.parentRest = rig[b].parent.getWorldQuaternion(new THREE.Quaternion());
  }
  // 눈 뼈의 정면 방향(부모 공간 기준). 기본 자세에서 인물은 +Z 를 본다.
  for (const e of [rig.lEye, rig.rEye]) {
    const wq = e.getWorldQuaternion(new THREE.Quaternion());
    e.userData.fwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(wq.invert());
  }
  rig.faces = faces;
  // 눈알은 뼈로 돌린다. 모프의 eyeLook* 은 눈꺼풀만 움직이도록 눈알 쪽 변위를 지운다.
  for (const f of faces) {
    if (f.material !== M.eyes) continue;
    const d = f.morphTargetDictionary, ma = f.geometry.morphAttributes;
    for (const name in d) if (name.startsWith('eyeLook')) for (const key in ma) ma[key][d[name]].array.fill(0);
  }
  const dict = faces[0].morphTargetDictionary;
  rig.morphIndex = dict;
  rig.morphNames = Object.keys(dict);
  rig.headPos = rig.head.getWorldPosition(new THREE.Vector3());
  rig.headFix = rig.head.getWorldQuaternion(new THREE.Quaternion()).invert();
  rig.ready = true;
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 900);
}, undefined, err => {
  console.error(err);
  $('#loadmsg').textContent = '인물을 불러오지 못했습니다. 새로고침해 주세요.';
});

// T자 → 팔을 내린 편한 자세. 위팔이 아래·살짝 앞을 향하도록 월드 기준으로 돌린다.
function poseArms(root, bone) {
  root.updateMatrixWorld(true);
  const aim = (b, child, dir) => {
    const a = b.getWorldPosition(new THREE.Vector3());
    const c = child.getWorldPosition(new THREE.Vector3());
    const cur = c.sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const bw = b.getWorldQuaternion(new THREE.Quaternion());
    const pw = b.parent.getWorldQuaternion(new THREE.Quaternion());
    b.quaternion.copy(pw.invert().multiply(q.multiply(bw)));
    b.updateMatrixWorld(true);
  };
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    aim(bone(s + '_UpperArm'), bone(s + '_Forearm'), new THREE.Vector3(0.2 * sx, -1, 0.04));
    aim(bone(s + '_Forearm'), bone(s + '_Hand'), new THREE.Vector3(0.1 * sx, -1, 0.3));
  }
}

// ───────────────────────── 표정 ─────────────────────────
const MOODS = {
  neutral: { label: '무표정', w: {} },
  soft: { label: '미소', w: { mouthSmileLeft: 0.45, mouthSmileRight: 0.42, cheekSquintLeft: 0.18, cheekSquintRight: 0.17, eyeSquintLeft: 0.1, eyeSquintRight: 0.1, mouthDimpleLeft: 0.12, mouthDimpleRight: 0.1 } },
  happy: { label: '활짝', w: { mouthSmileLeft: 0.95, mouthSmileRight: 0.9, cheekSquintLeft: 0.6, cheekSquintRight: 0.55, eyeSquintLeft: 0.45, eyeSquintRight: 0.42, mouthUpperUpLeft: 0.22, mouthUpperUpRight: 0.2, jawOpen: 0.1, mouthStretchLeft: 0.1, mouthStretchRight: 0.1, browInnerUp: 0.06 } },
  think: { label: '생각', w: { browDownLeft: 0.28, browDownRight: 0.08, browInnerUp: 0.18, mouthPressLeft: 0.25, mouthPressRight: 0.22, mouthLeft: 0.18, eyeSquintLeft: 0.18, eyeSquintRight: 0.1, mouthRollLower: 0.1 } },
  curious: { label: '궁금', w: { browInnerUp: 0.38, browOuterUpLeft: 0.32, browOuterUpRight: 0.18, eyeWideLeft: 0.18, eyeWideRight: 0.14, mouthPucker: 0.08, jawOpen: 0.02 } },
  surprise: { label: '놀람', w: { browInnerUp: 0.7, browOuterUpLeft: 0.65, browOuterUpRight: 0.65, eyeWideLeft: 0.55, eyeWideRight: 0.55, jawOpen: 0.22, mouthFunnel: 0.15 } },
  sad: { label: '슬픔', w: { browInnerUp: 0.55, browDownLeft: 0.12, browDownRight: 0.12, mouthFrownLeft: 0.35, mouthFrownRight: 0.35, mouthPressLeft: 0.15, mouthPressRight: 0.15, mouthShrugLower: 0.2, eyeSquintLeft: 0.12, eyeSquintRight: 0.12 } },
};
// 자동 모드에서 감정이 흘러가는 비율
const AUTO_FLOW = [['neutral', 0.3], ['soft', 0.36], ['happy', 0.08], ['think', 0.12], ['curious', 0.1], ['sad', 0.04]];

const S = {
  t: 0,
  mode: 'auto', mood: 'neutral', moodNext: 6,
  follow: true, handheld: true,
  pointer: { ndc: new THREE.Vector2(), last: -99 },
  gaze: { target: new THREE.Vector3(), cur: new THREE.Vector3(), off: new THREE.Vector2(), nextSac: 0, away: 0, awayUntil: 0, nextAway: rand(4, 8) },
  head: { yaw: 0, pitch: 0, roll: 0 },
  blink: { next: 1.2, start: -1, dbl: false, v: 0 },
  micro: [], microNext: 2,
  w: {}, // 현재 모프 값
  speech: null, talkEnv: 0, nod: 0,
};

function scheduleBlink(now, soon) {
  // 사람의 깜빡임 간격은 오른쪽 꼬리가 긴 분포(평균 3~4초)
  const gap = soon ? rand(0.15, 0.35) : clamp(0.5 + -Math.log(1 - Math.random()) * (S.speech ? 2.1 : 2.9), 0.6, 9);
  S.blink.next = now + gap;
}
function blinkValue(now) {
  const b = S.blink;
  if (b.start < 0 && now >= b.next) { b.start = now; b.dbl = Math.random() < 0.14; b.dur = rand(0.24, 0.32); }
  if (b.start < 0) return 0;
  const t = now - b.start, close = 0.075, hold = 0.035, open = b.dur - close - hold;
  let v;
  if (t < close) v = (t / close) ** 1.6;
  else if (t < close + hold) v = 1;
  else if (t < b.dur) v = 1 - smooth((t - close - hold) / open);
  else { b.start = -1; scheduleBlink(now, b.dbl); b.dbl = false; v = 0; }
  return v;
}

function addMicro(now) {
  const kinds = [
    { w: { browInnerUp: 0.22, browOuterUpLeft: 0.18, browOuterUpRight: 0.18 }, a: 0.12, h: 0.25, r: 0.35 }, // 눈썹 들썩
    { w: { mouthPressLeft: 0.3, mouthPressRight: 0.3, mouthRollLower: 0.12 }, a: 0.2, h: 0.5, r: 0.4 },    // 입술 다물기
    { w: { mouthSmileLeft: 0.16, cheekSquintLeft: 0.06 }, a: 0.15, h: 0.4, r: 0.5 },                       // 한쪽 입꼬리
    { w: { mouthSmileRight: 0.14, mouthDimpleRight: 0.1 }, a: 0.15, h: 0.4, r: 0.5 },
    { w: { noseSneerLeft: 0.12, noseSneerRight: 0.1, mouthUpperUpLeft: 0.05 }, a: 0.1, h: 0.15, r: 0.25 },   // 코 찡긋
    { w: { mouthShrugLower: 0.2, mouthClose: 0.08, jawForward: 0.06 }, a: 0.25, h: 0.3, r: 0.4 },          // 침 삼키기
    { w: { eyeSquintLeft: 0.15, eyeSquintRight: 0.15 }, a: 0.2, h: 0.6, r: 0.5 },                           // 살짝 눈 가늘게
  ];
  const k = pick(kinds);
  S.micro.push({ ...k, t0: now });
}

// ───────────────────────── 말하기(립싱크) ─────────────────────────
// 초성 19, 중성 21, 종성 28 → 오큘러스 비셈 15종
const CHO = ['KK', 'KK', 'nn', 'DD', 'DD', 'RR', 'PP', 'PP', 'PP', 'SS', 'SS', null, 'CH', 'CH', 'CH', 'KK', 'DD', 'PP', null];
const JUNG = [
  [['aa', 1]], [['E', 0.9]], [['I', 0.5], ['aa', 1]], [['I', 0.5], ['E', 0.9]], [['aa', 0.62], ['O', 0.25]], [['E', 0.85]],
  [['I', 0.5], ['aa', 0.62]], [['I', 0.5], ['E', 0.85]], [['O', 1]], [['U', 0.6], ['aa', 1]], [['U', 0.6], ['E', 0.9]],
  [['U', 0.6], ['E', 0.85]], [['I', 0.5], ['O', 1]], [['U', 1]], [['U', 0.6], ['aa', 0.7]], [['U', 0.6], ['E', 0.85]],
  [['U', 0.6], ['I', 0.8]], [['I', 0.5], ['U', 1]], [['I', 0.55]], [['I', 0.5], ['I', 0.8]], [['I', 0.85]],
];
const JONG = [null, 'KK', 'KK', 'KK', 'nn', 'nn', 'nn', 'DD', 'RR', 'KK', 'PP', 'RR', 'RR', 'RR', 'PP', 'RR', 'PP', 'PP', 'PP', 'DD', 'DD', 'KK', 'DD', 'DD', 'KK', 'DD', 'PP', 'DD'];
const LATIN = { a: 'aa', e: 'E', i: 'I', o: 'O', u: 'U', y: 'I', b: 'PP', m: 'PP', p: 'PP', f: 'FF', v: 'FF', d: 'DD', t: 'DD', l: 'nn', n: 'nn', s: 'SS', z: 'SS', c: 'KK', k: 'KK', g: 'KK', q: 'KK', x: 'KK', j: 'CH', r: 'RR', w: 'U', h: null };

function buildVisemes(text, rate) {
  const D = 0.17 / rate; // 음절 하나 길이(초)
  const segs = []; const charTime = [];
  let t = 0;
  const push = (v, s, d) => { segs.push({ v, s, t0: t, t1: t + d }); t += d; };
  for (let i = 0; i < text.length; i++) {
    charTime[i] = t;
    const ch = text[i], c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) {
      const s = c - 0xac00, cho = Math.floor(s / 588), jung = Math.floor((s % 588) / 28), jong = s % 28;
      const ci = CHO[cho], fi = JONG[jong];
      const vd = D * (ci ? 0.52 : 0.72) * (fi ? 0.85 : 1);
      if (ci) push(ci, ci === 'PP' ? 1 : 0.8, Math.max(ci === 'PP' ? 0.06 : 0.03, D * 0.26));
      const vs = JUNG[jung];
      if (vs.length === 1) push(vs[0][0], vs[0][1], vd);
      else { push(vs[0][0], vs[0][1], vd * 0.32); push(vs[1][0], vs[1][1], vd * 0.68); }
      if (fi) push(fi, fi === 'PP' ? 1 : 0.7, D * 0.22);
    } else if (/[a-z]/i.test(ch)) {
      const v = LATIN[ch.toLowerCase()];
      push(v || 'Sil', v && 'aeiou'.includes(ch.toLowerCase()) ? 0.9 : 0.75, D * 0.42);
    } else if (/[0-9]/.test(ch)) {
      push('aa', 0.8, D * 0.5); push('E', 0.8, D * 0.5); push('nn', 0.6, D * 0.3);
    } else if (/[.!?…]/.test(ch)) push('Sil', 0, 0.42 / rate);
    else if (/[,·;:]/.test(ch)) push('Sil', 0, 0.24 / rate);
    else if (/\s/.test(ch)) push('Sil', 0, 0.035 / rate);
  }
  charTime[text.length] = t;
  return { segs, charTime, dur: t };
}

let koVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang));
  const male = /InJoon|Hyunsu|Minsu|Bong|Gook|male/i;
  koVoice = vs.find(v => !male.test(v.name) && /Google|Yuna|SunHi|Heami|Yujin|Seoyeon|Natural/i.test(v.name))
    || vs.find(v => !male.test(v.name)) || vs[0] || null;
  return koVoice;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

function say(text) {
  text = text.trim().slice(0, 300);
  if (!text) return;
  stopSpeech();
  const rate = 1.0;
  const plan = buildVisemes(text, rate);
  const sp = { ...plan, start: performance.now() / 1000 + 0.05, offset: 0, text, synced: false, done: false };
  S.speech = sp;
  S.blink.next = Math.min(S.blink.next, S.t + 0.3);
  if ('speechSynthesis' in window && (koVoice || pickVoice())) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = koVoice; u.lang = koVoice.lang; u.rate = rate; u.pitch = 1.04;
    sp.start = Infinity; // 실제 소리가 나는 순간부터 시계를 돌린다
    u.onstart = () => { sp.start = performance.now() / 1000; };
    u.onboundary = e => {
      if (!isFinite(sp.start) || e.charIndex == null) return;
      const expected = sp.charTime[Math.min(e.charIndex, sp.charTime.length - 1)];
      const elapsed = performance.now() / 1000 - sp.start;
      sp.offset = expected - elapsed; // 엔진의 실제 속도에 맞춰 시간축을 당기거나 늦춘다
      sp.synced = true;
    };
    u.onend = () => { sp.done = true; };
    u.onerror = e => {
      // 끊긴 게 아니라 엔진이 실패한 경우엔 입 모양만이라도 끝까지 움직인다
      if (e.error === 'interrupted' || e.error === 'canceled') sp.done = true;
      else { sp.tts = false; if (!isFinite(sp.start)) sp.start = performance.now() / 1000; }
    };
    sp.tts = true;
    speechSynthesis.speak(u);
    // 음성이 끝내 시작되지 않으면(일부 브라우저) 입 모양만이라도 움직인다
    setTimeout(() => { if (!isFinite(sp.start) && S.speech === sp) sp.start = performance.now() / 1000; }, 1200);
  } else {
    toast('이 브라우저에는 한국어 음성이 없어 입 모양만 움직입니다.');
  }
}
function stopSpeech() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  S.speech = null;
}

function visemeAt(sp, now) {
  if (!isFinite(sp.start)) return null;
  const t = now - sp.start + sp.offset;
  if (sp.done) return 'end';
  if (t > sp.dur + 0.15) {
    if (!sp.tts || sp.synced || t > sp.dur * 1.6 + 1) return 'end';
    // 음성이 예상보다 느리게 끝나는 중: 소리가 끝날 때까지 가볍게 말하는 입 모양을 이어 간다
    const k = Math.floor((t - sp.dur) / 0.16);
    return { v: ['aa', 'E', 'O', 'I'][k % 4], s: 0.55, phase: 0, idx: -1 - k };
  }
  // 이진 탐색
  let lo = 0, hi = sp.segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (sp.segs[m].t0 <= t) lo = m; else hi = m - 1; }
  const s = sp.segs[lo];
  if (!s || t < 0) return { v: 'Sil', s: 0, phase: 0 };
  return { v: s.v, s: s.s, phase: (t - s.t0) / Math.max(1e-3, s.t1 - s.t0), idx: lo };
}

// ───────────────────────── 시선 ─────────────────────────
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
const ray = new THREE.Raycaster();

function updateGazeTarget(now, dt) {
  const g = S.gaze;
  camera.matrixWorld.extractBasis(camRight, camUp, tmpV);
  const pointerActive = S.follow && now - S.pointer.last < 2.5;
  // 시선을 잠깐 돌렸다 돌아오는 습관
  if (!pointerActive && !S.speech && now > g.nextAway && g.away === 0) {
    g.away = 1; g.awayUntil = now + rand(0.6, 1.8);
    const think = S.mood === 'think';
    g.awayOff = think ? new THREE.Vector2(rand(-55, -25), rand(20, 45))
      : pick([new THREE.Vector2(rand(-60, -30), rand(-25, 5)), new THREE.Vector2(rand(30, 60), rand(-25, 5)), new THREE.Vector2(rand(-20, 20), rand(-45, -30))]);
    if (Math.random() < 0.55) scheduleBlink(now, true);
  }
  if (g.away && now > g.awayUntil) { g.away = 0; g.nextAway = now + rand(3.5, 9) * (S.mood === 'think' ? 0.5 : 1); if (Math.random() < 0.5) scheduleBlink(now, true); }
  // 미세 도약 안구 운동: 상대의 두 눈과 입 사이를 오간다
  if (now > g.nextSac) {
    g.nextSac = now + rand(0.35, 1.6);
    g.off.set(pick([-3.2, 3.2, 0, -3.2, 3.2]), pick([0, 0, -4.5, 1]));
  }
  if (pointerActive) {
    ray.setFromCamera(S.pointer.ndc, camera);
    g.target.copy(ray.ray.origin).addScaledVector(ray.ray.direction, camera.position.distanceTo(LOOK) * 0.55);
  } else {
    g.target.copy(camera.position)
      .addScaledVector(camRight, g.off.x + (g.away ? g.awayOff.x : 0))
      .addScaledVector(camUp, g.off.y + (g.away ? g.awayOff.y : 0));
  }
  // 도약 운동은 빠르게(약 40ms), 드리프트는 노이즈로
  g.cur.x = damp(g.cur.x, g.target.x, 26, dt);
  g.cur.y = damp(g.cur.y, g.target.y, 26, dt);
  g.cur.z = damp(g.cur.z, g.target.z, 26, dt);
}

function setBoneWorldRot(b, euler, amount) {
  // 쉬는 자세 위에 월드 축 기준 회전을 얹는다
  tmpQ.setFromEuler(new THREE.Euler(euler.x * amount, euler.y * amount, euler.z * amount, 'YXZ'));
  const p = b.userData.parentRest;
  tmpQ2.copy(p).invert().multiply(tmpQ).multiply(p);
  b.quaternion.copy(tmpQ2).multiply(b.userData.rest);
}

function aimEye(e, target, headFwdQ) {
  e.parent.updateWorldMatrix(true, false);
  const pos = e.getWorldPosition(tmpV);
  const dir = tmpV2.copy(target).sub(pos).normalize();
  // 머리 기준 각도로 제한(사람 눈은 ±30° 남짓)
  const local = dir.clone().applyQuaternion(headFwdQ.clone().invert());
  let yaw = Math.atan2(local.x, local.z), pitch = Math.asin(clamp(local.y, -1, 1));
  yaw = clamp(yaw, -0.5, 0.5); pitch = clamp(pitch, -0.38, 0.32);
  const lim = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(headFwdQ);
  const pw = e.parent.getWorldQuaternion(tmpQ);
  const want = lim.applyQuaternion(pw.invert());
  const restDir = e.userData.fwdLocal.clone().applyQuaternion(e.userData.rest);
  e.quaternion.setFromUnitVectors(restDir, want).multiply(e.userData.rest);
  return { yaw, pitch };
}

// ───────────────────────── 매 프레임 ─────────────────────────
const target = {};
function animate(now, dt) {
  if (!rig.ready) return;
  const g = S.gaze, h = S.head;

  // 감정 흐름
  if (S.mode === 'auto' && now > S.moodNext && !S.speech) {
    let r = Math.random(), m = 'neutral';
    for (const [k, p] of AUTO_FLOW) { if ((r -= p) < 0) { m = k; break; } }
    S.mood = m; S.moodNext = now + rand(4, 10);
    if (m === 'think') { g.nextAway = now; }
  }
  if (now > S.microNext) { addMicro(now); S.microNext = now + rand(1.8, 5.5); }

  updateGazeTarget(now, dt);

  // 머리: 시선을 느리게 따라가고, 노이즈로 살아있는 흔들림
  const hp = rig.headPos;
  const dx = g.cur.x - hp.x, dy = g.cur.y - hp.y, dz = g.cur.z - hp.z;
  const yawE = Math.atan2(dx, dz), pitchE = Math.atan2(dy, Math.hypot(dx, dz));
  const talk = S.talkEnv;
  const idle = 1 + talk * 0.8;
  const moodTilt = S.mood === 'curious' ? 0.09 : S.mood === 'think' ? -0.05 : S.mood === 'sad' ? 0.04 : 0;
  const tYaw = yawE * 0.42 + NZ[0](now * 0.11) * 0.07 * idle;
  const tPitch = -pitchE * 0.3 + NZ[1](now * 0.13) * 0.045 * idle + (S.mood === 'sad' ? 0.08 : 0) + S.nod;
  const tRoll = NZ[2](now * 0.09) * 0.05 * idle + moodTilt;
  h.yaw = damp(h.yaw, tYaw, 3.2, dt);
  h.pitch = damp(h.pitch, tPitch, 3.6, dt);
  h.roll = damp(h.roll, tRoll, 2.2, dt);

  // 호흡(약 4.3초 주기)
  const br = 0.5 - 0.5 * Math.cos(now * Math.PI * 2 / (4.3 + NZ[3](now * 0.05) * 0.6));
  setBoneWorldRot(rig.spine1, new THREE.Vector3(-br * 0.012 + NZ[4](now * 0.07) * 0.01, NZ[5](now * 0.06) * 0.015, NZ[6](now * 0.05) * 0.012), 1);
  setBoneWorldRot(rig.spine2, new THREE.Vector3(-br * 0.016, 0, 0), 1);
  setBoneWorldRot(rig.lClav, new THREE.Vector3(0, 0, br * 0.018), 1);
  setBoneWorldRot(rig.rClav, new THREE.Vector3(0, 0, -br * 0.018), 1);
  const he = new THREE.Vector3(h.pitch + br * 0.008, h.yaw, h.roll);
  setBoneWorldRot(rig.neck, he, 0.4);
  setBoneWorldRot(rig.head, he, 0.6);
  rig.root.updateMatrixWorld(true);

  // 쉬는 자세 대비 머리 회전(정면 +Z 가 지금 어디를 향하는지)
  const headFwdQ = rig.head.getWorldQuaternion(new THREE.Quaternion()).multiply(rig.headFix);
  // 눈은 같은 점을 본다(수렴), 아주 작은 떨림 추가
  const jit = tmpV.set(NZ[7](now * 3.1) * 0.25, NZ[8](now * 2.7) * 0.25, 0);
  const tgt = g.cur.clone().add(jit);
  const la = aimEye(rig.lEye, tgt, headFwdQ);
  aimEye(rig.rEye, tgt, headFwdQ);

  // ── 모프 목표값 합성 ──
  for (const k of rig.morphNames) target[k] = 0;
  const add = (k, v) => { if (k in target) target[k] += v; };
  const mw = MOODS[S.mood].w;
  const moodAmt = S.speech ? 0.55 : 1;
  for (const k in mw) add(k, mw[k] * moodAmt);
  // 미세표정
  S.micro = S.micro.filter(m => {
    const t = now - m.t0, e = t < m.a ? smooth(t / m.a) : t < m.a + m.h ? 1 : 1 - smooth((t - m.a - m.h) / m.r);
    if (t > m.a + m.h + m.r) return false;
    for (const k in m.w) add(k, m.w[k] * e);
    return true;
  });
  // 눈꺼풀이 시선을 따라간다
  add('eyeLookUpLeft', clamp01(la.pitch / 0.32) * 0.5); add('eyeLookUpRight', clamp01(la.pitch / 0.32) * 0.5);
  add('eyeLookDownLeft', clamp01(-la.pitch / 0.38) * 0.65); add('eyeLookDownRight', clamp01(-la.pitch / 0.38) * 0.65);
  add('eyeLookOutLeft', clamp01(la.yaw / 0.5) * 0.3); add('eyeLookInRight', clamp01(la.yaw / 0.5) * 0.3);
  add('eyeLookInLeft', clamp01(-la.yaw / 0.5) * 0.3); add('eyeLookOutRight', clamp01(-la.yaw / 0.5) * 0.3);
  // 호흡에 따라 콧볼이 아주 조금
  add('noseSneerLeft', br * 0.03); add('noseSneerRight', br * 0.03);
  add('jawOpen', (1 - br) * 0.012);

  // 말하기
  let talking = 0;
  if (S.speech) {
    const vz = visemeAt(S.speech, performance.now() / 1000);
    if (vz === 'end') { S.speech = null; S.blink.next = Math.min(S.blink.next, now + 0.25); }
    else if (vz) {
      talking = 1;
      if (vz.v !== 'Sil') add('viseme_' + vz.v, vz.s * 0.95);
      // 음절 머리에서 고개·눈썹으로 강세
      if (vz.idx !== S.lastSeg) {
        S.lastSeg = vz.idx;
        if (vz.v === 'aa' || vz.v === 'O' || vz.v === 'E') { if (Math.random() < 0.18) S.nodKick = 1; if (Math.random() < 0.08) addMicro(now); }
      }
    }
  }
  S.talkEnv = damp(S.talkEnv, talking, 4, dt);
  S.nodKick = damp(S.nodKick || 0, 0, 7, dt);
  S.nod = damp(S.nod, (S.nodKick || 0) * 0.035, 10, dt);
  add('browInnerUp', S.talkEnv * 0.08 * (0.5 + 0.5 * NZ[9](now * 0.7)));
  add('browOuterUpLeft', S.talkEnv * 0.06 * Math.max(0, NZ[10](now * 0.8)));

  // 깜빡임: 시선 변화가 크면 따라 깜빡인다
  const bl = blinkValue(now);
  const sq = (target.eyeSquintLeft || 0);
  const blinkL = bl, blinkR = clamp01(bl * 0.97 + (bl > 0 ? 0.02 : 0));

  // 부드럽게 따라가기: 입 모양은 빠르게, 표정은 천천히
  for (const k of rig.morphNames) {
    const tv = clamp01(target[k]);
    const isVis = k.startsWith('viseme_');
    const speed = isVis ? 22 : k.startsWith('eyeLook') ? 30 : k.startsWith('eyeBlink') ? 1e9 : 4.5;
    S.w[k] = damp(S.w[k] || 0, tv, speed, dt);
  }
  S.w.eyeBlinkLeft = clamp01(blinkL + sq * 0.15);
  S.w.eyeBlinkRight = clamp01(blinkR + sq * 0.15);
  const idx = rig.morphIndex;
  for (const f of rig.faces) { const inf = f.morphTargetInfluences; for (const k of rig.morphNames) inf[idx[k]] = S.debugW ? (S.debugW[k] || 0) : S.w[k]; }
}

// 핸드헬드 카메라: 아주 작은 흔들림과 숨쉬는 듯한 줌
function updateCamera(now) {
  const a = S.handheld ? 1 : 0;
  camera.position.set(
    CAM_BASE.x + NZ[11](now * 0.23) * 0.9 * a,
    CAM_BASE.y + lookYOff + NZ[3](now * 0.19 + 50) * 0.6 * a,
    CAM_BASE.z + NZ[5](now * 0.07 + 20) * 2.5 * a,
  );
  camera.lookAt(LOOK.x + NZ[6](now * 0.31 + 9) * 0.25 * a, LOOK.y + lookYOff + NZ[7](now * 0.27 + 4) * 0.2 * a, LOOK.z);
}

// ───────────────────────── 크기 · 품질 ─────────────────────────
let quality = 'high';
let lookYOff = 0;
const LOCK_Q = new URLSearchParams(location.search).has('hq'); // 자동 화질 낮춤 끄기
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = quality === 'high' ? Math.min(devicePixelRatio, 2) : Math.min(devicePixelRatio, 1);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  camera.aspect = w / h;
  // 세로 화면에서는 어깨까지, 가로 화면에서는 가슴까지 보이도록 화각을 맞춘다
  const portrait = w / h < 0.8;
  camera.fov = portrait ? 15 : 14;
  lookYOff = portrait ? -1.5 : 0; // 세로 화면은 아래 조작부를 피해 얼굴을 위쪽에
  camera.updateProjectionMatrix();
  film.uniforms.res.value.set(w * pr, h * pr);
}
addEventListener('resize', resize);
resize();

// ───────────────────────── 루프 · 녹화 ─────────────────────────
const timer = new THREE.Timer();
let shotPending = false, frames = 0, fpsT = 0, lowFps = 0;
function loop() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  S.t += dt;
  updateCamera(S.t);
  animate(S.t, dt);
  film.uniforms.time.value = S.t;
  composer.render();
  if (shotPending) { shotPending = false; canvas.toBlob(b => download(b, `digital-human-${stamp()}.png`), 'image/png'); }
  // 느린 기기는 자동으로 가벼운 화질로
  frames++; fpsT += dt;
  if (fpsT > 3) {
    const fps = frames / fpsT; frames = 0; fpsT = 0;
    if (rig.ready && !LOCK_Q && quality === 'high' && fps < 28 && ++lowFps >= 2) setQuality('low', true);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function setQuality(q, auto) {
  quality = q;
  key.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
  if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
  rt.samples = q === 'high' ? 4 : 0;
  resize();
  $('#q').textContent = q === 'high' ? '화질: 높음' : '화질: 가볍게';
  if (auto) toast('기기 성능에 맞춰 가벼운 화질로 바꿨어요.');
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

let rec = null;
function toggleRecord() {
  if (rec) { rec.stop(); return; }
  if (!window.MediaRecorder || !canvas.captureStream) { toast('이 브라우저는 화면 녹화를 지원하지 않아요.'); return; }
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm'];
  const type = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  const stream = canvas.captureStream(30);
  const r = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
  const chunks = [];
  r.ondataavailable = e => e.data.size && chunks.push(e.data);
  const btn = $('#rec'), t0 = performance.now();
  const tick = setInterval(() => { btn.querySelector('span').textContent = '녹화 중 ' + fmt((performance.now() - t0) / 1000); if (performance.now() - t0 > 60000) r.stop(); }, 250);
  r.onstop = () => {
    clearInterval(tick); rec = null; btn.classList.remove('on'); btn.querySelector('span').textContent = '영상 녹화';
    const mime = r.mimeType || type || 'video/webm';
    download(new Blob(chunks, { type: mime }), `digital-human-${stamp()}.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
  };
  r.start(250); rec = r; btn.classList.add('on');
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ───────────────────────── UI ─────────────────────────
addEventListener('pointermove', e => {
  if (e.target.closest && e.target.closest('.panel')) return;
  const r = canvas.getBoundingClientRect();
  S.pointer.ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  S.pointer.last = S.t;
});

const moodBar = $('#moods');
const moodBtns = [['auto', '자연스럽게'], ...Object.entries(MOODS).map(([k, v]) => [k, v.label])];
for (const [k, label] of moodBtns) {
  const b = document.createElement('button');
  b.className = 'chip' + (k === 'auto' ? ' on' : ''); b.textContent = label; b.dataset.mood = k;
  b.onclick = () => {
    moodBar.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
    if (k === 'auto') { S.mode = 'auto'; S.moodNext = S.t + 1; }
    else { S.mode = 'manual'; S.mood = k; if (k === 'surprise') scheduleBlink(S.t, true); }
  };
  moodBar.appendChild(b);
}

const LINES = [
  '안녕하세요. 저는 브라우저 안에서 실시간으로 움직이는 디지털 휴먼이에요.',
  '오늘 하루는 어떠셨어요? 저는 당신을 기다리고 있었어요.',
  '마우스를 움직여 보세요. 제가 눈으로 따라갈게요.',
  '사진도 찍고, 영상으로 녹화해서 저장할 수도 있어요.',
];
const linesEl = $('#lines');
LINES.forEach(l => {
  const b = document.createElement('button'); b.className = 'line'; b.textContent = l;
  b.onclick = () => { $('#text').value = l; say(l); };
  linesEl.appendChild(b);
});
$('#sayform').onsubmit = e => { e.preventDefault(); say($('#text').value); };
$('#shot').onclick = () => { shotPending = true; };
$('#rec').onclick = toggleRecord;
$('#q').onclick = () => setQuality(quality === 'high' ? 'low' : 'high');
$('#follow').onclick = e => { S.follow = !S.follow; e.currentTarget.classList.toggle('on', S.follow); };
$('#hand').onclick = e => { S.handheld = !S.handheld; e.currentTarget.classList.toggle('on', S.handheld); };
$('#hide').onclick = () => document.body.classList.toggle('clean');
addEventListener('keydown', e => { if (e.key === 'h' && e.target === document.body) document.body.classList.toggle('clean'); });

// 테스트용 훅
window.__human = { S, rig, say, MOODS, setQuality, camera, CAM_BASE, LOOK };
