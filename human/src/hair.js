// 가닥 머리카락. 원래 머리카락 '카드'(판)는 헤어스타일의 모양을 알려 주는 가이드로 쓰고,
// 그 표면 위에 수만 개의 짧은 가닥을 심어 반투명(알파 블렌딩)으로 겹쳐 그린다.
//
// - 카드마다 가장 긴 축(PCA)을 가닥 방향으로 잡고, 정수리에서 멀어지는 쪽으로 향하게 한다.
// - 텍스처 알파가 있는 곳(실제로 머리카락이 그려진 곳)에만 심는다.
// - 두피에 그려진 머리카락(얼굴 텍스처에서 어두운 곳)에도 정수리에서 흘러내리는 방향으로 심는다.
// - 가닥은 1픽셀 안팎 폭의 리본으로, 정확한 결 방향(접선)으로 Kajiya-Kay 반사를 계산한다.
import * as THREE from 'three';

const clamp01 = x => Math.min(1, Math.max(0, x));

function imageData(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  // TextureLoader 는 flipY=true 로 올리므로 uv(u,v) → 픽셀(u·W, (1−v)·H)
  return (u, v) => {
    const x = Math.min(d.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * d.width)));
    const y = Math.min(d.height - 1, Math.max(0, Math.floor((1 - (v - Math.floor(v))) * d.height)));
    const i = 4 * (y * d.width + x);
    return [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
  };
}

// 메시의 삼각형을 월드 좌표(쉬는 자세)로 꺼낸다
function triangles(mesh, filterTri) {
  const g = mesh.geometry, P = g.attributes.position, UV = g.attributes.uv, I = g.index;
  const v = new THREE.Vector3(), out = [];
  const pos = new Float32Array(P.count * 3);
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], 3 * i); }
  const n = I ? I.count : P.count;
  for (let t = 0; t < n; t += 3) {
    const ia = I ? I.getX(t) : t, ib = I ? I.getX(t + 1) : t + 1, ic = I ? I.getX(t + 2) : t + 2;
    const tri = {
      i: [ia, ib, ic],
      a: new THREE.Vector3().fromArray(pos, 3 * ia), b: new THREE.Vector3().fromArray(pos, 3 * ib), c: new THREE.Vector3().fromArray(pos, 3 * ic),
      ua: [UV.getX(ia), UV.getY(ia)], ub: [UV.getX(ib), UV.getY(ib)], uc: [UV.getX(ic), UV.getY(ic)],
    };
    const e1 = tri.b.clone().sub(tri.a), e2 = tri.c.clone().sub(tri.a);
    tri.n = e1.clone().cross(e2); tri.area = tri.n.length() / 2; tri.n.normalize();
    tri.T = new THREE.Triangle(tri.a, tri.b, tri.c);
    if (tri.area > 1e-6 && (!filterTri || filterTri(tri))) out.push(tri);
  }
  return out;
}

// 카드(연결 성분)마다 긴 축
function cardAxes(tris, crown) {
  const parent = new Map();
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const t of tris) for (const i of t.i) if (!parent.has(i)) parent.set(i, i);
  for (const t of tris) { const r = find(t.i[0]); parent.set(find(t.i[1]), r); parent.set(find(t.i[2]), find(r)); }
  const groups = new Map();
  for (const t of tris) { const r = find(t.i[0]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
  for (const list of groups.values()) {
    const c = new THREE.Vector3(); let A = 0;
    for (const t of list) { c.addScaledVector(t.a.clone().add(t.b).add(t.c).divideScalar(3), t.area); A += t.area; }
    c.divideScalar(A);
    // 공분산 → 거듭제곱법으로 주축
    const C = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const t of list) for (const p of [t.a, t.b, t.c]) {
      const d = [p.x - c.x, p.y - c.y, p.z - c.z];
      for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) C[3 * r + q] += d[r] * d[q] * t.area;
    }
    let ax = new THREE.Vector3(0.1, -1, 0.2).normalize();
    for (let k = 0; k < 30; k++) {
      ax = new THREE.Vector3(C[0] * ax.x + C[1] * ax.y + C[2] * ax.z, C[3] * ax.x + C[4] * ax.y + C[5] * ax.z, C[6] * ax.x + C[7] * ax.y + C[8] * ax.z).normalize();
    }
    // 정수리에서 멀어지는(그리고 아래로 흐르는) 쪽으로
    const away = c.clone().sub(crown).normalize().add(new THREE.Vector3(0, -0.6, 0));
    if (ax.dot(away) < 0) ax.negate();
    for (const t of list) { t.axis = ax; t.card = list; }
  }
}

function sampler(tris) {
  const cum = new Float64Array(tris.length); let s = 0;
  tris.forEach((t, i) => { s += t.area; cum[i] = s; });
  return () => {
    const r = Math.random() * s; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return tris[lo];
  };
}

export const HAIR_STRANDS = { off: { value: new THREE.Vector3() }, time: { value: 0 }, lightDir: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] }, lightCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color(), new THREE.Color()] }, ambient: { value: new THREE.Color() } };

/**
 * @param {object} o
 * @param {THREE.Mesh} o.cards 머리카락 카드 메시
 * @param {THREE.Mesh} o.scalp 두피(머리카락이 그려진 피부) 메시
 * @param {HTMLImageElement} o.hairImg  카드 텍스처
 * @param {HTMLImageElement} o.scalpImg 얼굴/두피 텍스처
 * @param {THREE.Bone} o.head 가닥을 붙일 머리 뼈
 * @param {THREE.Matrix4} o.headBind 쉬는 자세에서의 머리 뼈 월드 행렬
 * @param {THREE.Vector3} o.crown 정수리(월드)
 * @param {number} o.count 가닥 수(카드 + 두피)
 */
export function buildStrands({ cards, scalp, hairImg, scalpImg, head, headBind, crown, count = 70000 }) {
  const hairPx = imageData(hairImg), scalpPx = imageData(scalpImg);
  const bary = (t, r1, r2) => { const s = Math.sqrt(r1); return [1 - s, s * (1 - r2), s * r2]; };
  const uvAt = (t, w) => [t.ua[0] * w[0] + t.ub[0] * w[1] + t.uc[0] * w[2], t.ua[1] * w[0] + t.ub[1] * w[1] + t.uc[1] * w[2]];
  const posAt = (t, w) => t.a.clone().multiplyScalar(w[0]).addScaledVector(t.b, w[1]).addScaledVector(t.c, w[2]);

  // cards: 메시 하나 또는 [{ mesh, filter }] 목록
  const cardTris = (Array.isArray(cards) ? cards : [{ mesh: cards }]).flatMap(c => triangles(c.mesh, c.filter));
  cardAxes(cardTris, crown);
  // 두피: 텍스처가 어두운(머리카락이 그려진) 삼각형만
  const isHairPx = px => (px[0] + px[1] + px[2]) / 3 < 48;
  const scalpTris = triangles(scalp, t => {
    const c = [(t.ua[0] + t.ub[0] + t.uc[0]) / 3, (t.ua[1] + t.ub[1] + t.uc[1]) / 3];
    return isHairPx(scalpPx(c[0], c[1]));
  });
  let top = -Infinity;
  for (const t of cardTris) top = Math.max(top, t.a.y, t.b.y, t.c.y);

  const SEG = 8; // 가닥 하나의 점 수
  const nCard = Math.round(count * (scalpTris.length ? 0.72 : 1)), nScalp = count - nCard;
  const total = nCard + nScalp;
  const nV = total * SEG * 2;
  const position = new Float32Array(nV * 3), tangent = new Float32Array(nV * 3), extra = new Float32Array(nV * 4); // side, tpos, hang, shade
  const index = new Uint32Array(total * (SEG - 1) * 6);
  const toLocal = (headBind || head.matrixWorld).clone().invert();
  const rotLocal = new THREE.Matrix3().setFromMatrix4(toLocal);
  let vi = 0, ii = 0, made = 0;
  const pCard = sampler(cardTris), pScalp = scalpTris.length ? sampler(scalpTris) : null;
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Quaternion(), cp = new THREE.Vector3(), best = new THREE.Vector3();

  // 점 목록(월드) → 리본 정점
  const emitPts = (pts, shade) => {
    const base = vi / 2;
    for (let k = 0; k < pts.length; k++) {
      const s = k / (pts.length - 1);
      const tg = pts[Math.min(k + 1, pts.length - 1)].clone().sub(pts[Math.max(k - 1, 0)]).normalize();
      const p = pts[k].clone();
      const hang = clamp01((top - 4 - p.y) / 26) ** 1.4;
      p.applyMatrix4(toLocal); tg.applyMatrix3(rotLocal).normalize();
      for (const side of [-1, 1]) {
        position.set([p.x, p.y, p.z], 3 * vi); tangent.set([tg.x, tg.y, tg.z], 3 * vi);
        extra.set([side, s, hang, shade], 4 * vi); vi++;
      }
      if (k < pts.length - 1) { const a = base + 2 * k; index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii); ii += 6; }
    }
    made++;
  };
  // 곧은 짧은 가닥(두피용)
  const emit = (p0, d, n, len, lift, shade, curl) => {
    const pts = [];
    for (let k = 0; k < SEG; k++) { const s = k / (SEG - 1); pts.push(p0.clone().addScaledVector(d, len * (s - 0.5)).addScaledVector(n, lift + Math.sin(s * Math.PI) * curl)); }
    emitPts(pts, shade);
  };
  // 카드 곡면을 따라 걷는 긴 가닥: 한 걸음마다 같은 카드에서 가장 가까운 면으로 다시 붙이고, 그 면 위로 결 방향을 다시 잡는다
  const walk = (t0, p0, side, len, lift, twist) => {
    const step = len / (SEG - 1), pts = [];
    let t = t0, p = p0.clone();
    dir.copy(t.axis).addScaledVector(t.n, -t.axis.dot(t.n)).normalize();
    q.setFromAxisAngle(t.n, twist); dir.applyQuaternion(q);
    for (let k = 0; k < SEG; k++) {
      pts.push(p.clone().addScaledVector(t.n, side * lift));
      p.addScaledVector(dir, step);
      let bd = Infinity, bt = t;
      for (const c of t.card) { c.T.closestPointToPoint(p, cp); const d2 = cp.distanceToSquared(p); if (d2 < bd) { bd = d2; bt = c; best.copy(cp); } }
      p.copy(best); t = bt;
      const nd = tmp.copy(t.axis).addScaledVector(t.n, -t.axis.dot(t.n)).normalize();
      dir.lerp(nd, 0.35).addScaledVector(t.n, -dir.dot(t.n)).normalize();
    }
    return pts;
  };

  // 카드 위의 가닥
  for (let k = 0, guard = 0; k < nCard && guard < nCard * 8; guard++) {
    const t = pCard(), w = bary(t, Math.random(), Math.random());
    const uv = uvAt(t, w);
    if (hairPx(uv[0], uv[1])[3] < 110) continue; // 투명한 곳엔 심지 않는다
    const side = Math.random() < 0.5 ? -1 : 1;
    const pts = walk(t, posAt(t, w), side, 5 + Math.random() * 8, Math.random() * 0.3, (Math.random() - 0.5) * 0.18);
    emitPts(pts, Math.random());
    k++;
  }
  // 두피 위의 가닥: 정수리에서 흘러내리는 방향
  for (let k = 0, guard = 0; pScalp && k < nScalp && guard < nScalp * 8; guard++) {
    const t = pScalp(), w = bary(t, Math.random(), Math.random());
    const uv = uvAt(t, w);
    if (!isHairPx(scalpPx(uv[0], uv[1]))) continue;
    const p = posAt(t, w);
    tmp.copy(p).sub(crown).add(new THREE.Vector3(0, -2, 0));
    dir.copy(tmp).addScaledVector(t.n, -tmp.dot(t.n));
    if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0).addScaledVector(t.n, t.n.y);
    dir.normalize();
    q.setFromAxisAngle(t.n, (Math.random() - 0.5) * 0.35); dir.applyQuaternion(q);
    emit(p, dir.clone(), t.n.clone(), 2 + Math.random() * 2.5, 0.05 + Math.random() * 0.2, Math.random() * 0.8, Math.random() * 0.1);
    k++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position.subarray(0, vi * 3), 3));
  geo.setAttribute('hairTangent', new THREE.BufferAttribute(tangent.subarray(0, vi * 3), 3));
  geo.setAttribute('hairExtra', new THREE.BufferAttribute(extra.subarray(0, vi * 4), 4));
  geo.setIndex(new THREE.BufferAttribute(index.subarray(0, ii), 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uOff: HAIR_STRANDS.off, uTime: HAIR_STRANDS.time, uLightDir: HAIR_STRANDS.lightDir, uLightCol: HAIR_STRANDS.lightCol, uAmbient: HAIR_STRANDS.ambient,
      uWidth: { value: 0.04 }, uColor: { value: new THREE.Color(0.11, 0.07, 0.048) }, uAlpha: { value: 0.75 },
    },
    vertexShader: /* glsl */`
      attribute vec3 hairTangent; attribute vec4 hairExtra;
      uniform vec3 uOff; uniform float uTime, uWidth;
      varying vec3 vT, vView; varying float vS, vShade;
      void main() {
        float side = hairExtra.x, s = hairExtra.y, hang = hairExtra.z;
        vec3 p = position + uOff * hang;
        p += vec3( sin( uTime * 1.3 + position.y * 0.17 + position.x * 0.05 ), 0.0, sin( uTime * 1.05 + position.x * 0.21 ) ) * 0.14 * hang;
        vec4 mv = modelViewMatrix * vec4( p, 1.0 );
        vec3 t = normalize( ( modelViewMatrix * vec4( hairTangent, 0.0 ) ).xyz );
        vec3 sideDir = normalize( cross( t, normalize( -mv.xyz ) ) );
        mv.xyz += sideDir * side * uWidth * mix( 1.0, 0.45, s );
        vT = t; vView = -mv.xyz; vS = s; vShade = hairExtra.w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLightDir[4]; uniform vec3 uLightCol[4]; uniform vec3 uAmbient, uColor; uniform float uAlpha;
      varying vec3 vT, vView; varying float vS, vShade;
      void main() {
        vec3 T = normalize( vT ), V = normalize( vView );
        vec3 col = uColor * ( 0.45 + 1.3 * vShade * vShade );
        vec3 acc = uAmbient * col;
        float sh = ( vShade - 0.5 ) * 0.2;
        for ( int i = 0; i < 4; i ++ ) {
          vec3 L = uLightDir[ i ];
          float tl = dot( T, L );
          float diff = sqrt( max( 0.0, 1.0 - tl * tl ) ) * 0.75 + 0.1;  // Kajiya 디퓨즈
          vec3 H = normalize( L + V );
          float t1 = dot( normalize( T + vec3( 0.0 ) * sh ), H ) + 0.06 + sh;
          float t2 = dot( T, H ) - 0.12 + sh;
          float s1 = pow( sqrt( max( 0.0, 1.0 - t1 * t1 ) ), 280.0 );
          float s2 = pow( sqrt( max( 0.0, 1.0 - t2 * t2 ) ), 60.0 );
          acc += uLightCol[ i ] * ( col * diff + s1 * 0.11 * ( 0.4 + vShade ) + s2 * 0.06 * vec3( 0.85, 0.6, 0.45 ) );
        }
        // 가닥 양 끝은 가늘게 사라진다
        float a = uAlpha * smoothstep( 0.0, 0.12, vS ) * ( 1.0 - smoothstep( 0.72, 1.0, vS ) );
        gl_FragColor = vec4( acc, a );
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'HairStrands';
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  head.add(mesh);
  return { mesh, strands: made, cardTris: cardTris.length, scalpTris: scalpTris.length };
}
