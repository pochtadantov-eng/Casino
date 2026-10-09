// Tower game, real 3D (Three.js): construction site, tower crane, concrete platform and house models.
// Rendering only. Every outcome comes from the round state passed to sync(); the SERVER decides if a house sits.
(() => {
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const rand = (a, b) => a + Math.random() * (b - a);

  const INC = 1.24, HALF = 0.62, PLAT_TOP = 0.5, ROPE = 1.5, HOOKH = 0.6, CRANE_X = 5.6, CRANE_Z = 0, COLORS = [0xffc21a, 0x9d4dff, 0x19d97b, 0xff4d5a, 0x2db7ff];

  class TowerGame3D {
    constructor(canvas) {
      const THREE = (this.T = window.THREE); this.c = canvas;
      this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
      this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0xdce9f4, 42, 95);
      this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
      this.az = 0.52; this.el = 0.43; this.camTy = 7; this.camH = 21; this.jibY = 13.8;
      this.buildMaterials(); this.buildSky(); this.buildLights(); this.buildGround(); this.buildPlatform(); this.buildProps(); this.buildCrane(); this.buildExtras();
      this.ci = 0; this.roundId = null; this.onReady = null; this._ready = null; this.houseGroup = new THREE.Group(); this.scene.add(this.houseGroup);
      this.reset(); this.resize(); this.update(0, 0);                // place the camera before the first paint
      this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas);
      this.last = performance.now(); this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    }

    // ---------------------------------------------------------------- scene building
    buildMaterials() {
      const T = this.T, L = (c) => new T.MeshLambertMaterial({ color: c });
      this.m = {
        walls: COLORS.map((c) => L(c)), roof: L(0x757c84), glass: new T.MeshStandardMaterial({ color: 0x8fd0ff, roughness: 0.15, metalness: 0.25, emissive: 0x2b6fa8, emissiveIntensity: 0.4 }),
        frame: L(0xf3efe6), door: L(0x7a4a24), knob: new T.MeshStandardMaterial({ color: 0xe6c066, metalness: 0.6, roughness: 0.35 }),
        orange: L(0xf2a33a), orangeD: L(0xd98a22), steel: L(0x9db3c4), concrete: L(0xaeb8c2), concreteD: L(0x93a0ad), dirt: L(0x8c8579), sand: L(0xf0c44f), hazY: L(0xf6b50b), hazK: L(0x2c343e),
        glassC: new T.MeshStandardMaterial({ color: 0x5b7fa3, roughness: 0.2, metalness: 0.3, emissive: 0x24415f, emissiveIntensity: 0.4 }), cw: L(0xa9c1d9), tree: L(0x7aa84b), trunk: L(0x8b6a4a), red: L(0xe5453d), white: L(0xffffff),
        pipe: L(0x8aa1b6), green: L(0x6aa84f), dark: L(0x56606a),
      };
      this.g = { box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, 14), sph: new T.SphereGeometry(1, 16, 12), plane: new T.PlaneGeometry(1, 1) };
    }
    mesh(geo, mat, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0, cast = true) { const m = new this.T.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; return m; }
    buildSky() {
      const T = this.T, cv = document.createElement('canvas'); cv.width = 2; cv.height = 256; const x = cv.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#f4f9fe'); gr.addColorStop(0.55, '#e7f1f9'); gr.addColorStop(1, '#d3e4f2'); x.fillStyle = gr; x.fillRect(0, 0, 2, 256); this.scene.background = new T.CanvasTexture(cv);
      // far city silhouettes (flat colour so fog melts them into the sky)
      const mat = [new T.MeshBasicMaterial({ color: 0xd3e3f1 }), new T.MeshBasicMaterial({ color: 0xc6dbed })];
      for (let i = 0; i < 26; i++) { const w = rand(3, 6.5), h = rand(6, 22), m = new T.Mesh(this.g.box, mat[i % 2]); m.scale.set(w, h, rand(3, 6)); m.position.set(-60 + i * 4.8 + rand(-1, 1), h / 2 - 0.2, -34 - (i % 2) * 8 - rand(0, 4)); this.scene.add(m); }
      const sp = new T.Mesh(new T.ConeGeometry(1.2, 14, 4), mat[1]); sp.position.set(14, 18, -40); this.scene.add(sp);
    }
    buildLights() {
      const T = this.T; this.scene.add(new T.HemisphereLight(0xffffff, 0xb4b0a8, 0.72));
      const d = new T.DirectionalLight(0xffffff, 0.82); d.position.set(-9, 16, 10); d.castShadow = true; d.shadow.mapSize.set(1024, 1024);
      Object.assign(d.shadow.camera, { left: -13, right: 13, top: 22, bottom: -6, near: 1, far: 60 }); d.shadow.bias = -0.0006; d.shadow.normalBias = 0.02; this.scene.add(d); this.sun = d;
    }
    buildGround() { const g = this.mesh(this.g.plane, this.m.dirt, 160, 160, 1, 0, 0, 0, false); g.rotation.x = -Math.PI / 2; this.scene.add(g); }
    buildPlatform() {
      const T = this.T, grp = new T.Group(), W = 4.8; this.platform = grp;
      grp.add(this.mesh(this.g.box, this.m.concrete, W, PLAT_TOP, W, 0, PLAT_TOP / 2, 0));
      grp.add(this.mesh(this.g.box, this.m.concreteD, W + 0.28, 0.16, W + 0.28, 0, 0.08, 0));           // wider foot
      // hazard stripes: alternating blocks on the top edge, all four sides
      const n = 12, seg = (W - 0.3) / n;
      for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) for (let i = 0; i < n; i++) {
        const t = -((W - 0.3) / 2) + seg * (i + 0.5), edge = (W / 2 - 0.17) * sgn, m = ax === 'x' ? this.mesh(this.g.box, i % 2 ? this.m.hazK : this.m.hazY, seg, 0.04, 0.26, t, PLAT_TOP + 0.02, edge, false) : this.mesh(this.g.box, i % 2 ? this.m.hazK : this.m.hazY, 0.26, 0.04, seg, edge, PLAT_TOP + 0.02, t, false);
        grp.add(m);
      }
      // corner posts with blinking lamps
      this.lamps = [];
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        grp.add(this.mesh(this.g.cyl, this.m.dark, 0.07, 0.7, 0.07, x * (W / 2 - 0.1), PLAT_TOP + 0.35, z * (W / 2 - 0.1)));
        const lamp = new T.Mesh(this.g.sph, new T.MeshBasicMaterial({ color: 0xffd23f })); lamp.scale.setScalar(0.14); lamp.position.set(x * (W / 2 - 0.1), PLAT_TOP + 0.78, z * (W / 2 - 0.1)); grp.add(lamp); this.lamps.push(lamp);
      }
      this.scene.add(grp);
    }
    buildProps() {
      const T = this.T, add = (o) => { this.scene.add(o); return o; };
      for (const [x, z, s] of [[-5.4, 2.2, 1.5], [4.4, 4.6, 1.2], [-2.8, -5.4, 1.6], [8.6, 0.8, 1.3]]) { const m = this.mesh(this.g.sph, this.m.sand, s, s * 0.45, s, x, 0, z); add(m); }
      for (let i = 0; i < 6; i++) { const row = i < 3 ? 0 : 1, k = i < 3 ? i : i - 3, p = this.mesh(this.g.cyl, this.m.pipe, 0.16, 2.6, 0.16, -6.6 + (k + row * 0.5) * 0.36, 0.17 + row * 0.3, 4.4); p.rotation.z = Math.PI / 2; add(p); }
      // barrier
      const bar = new T.Group(); bar.add(this.mesh(this.g.box, this.m.dark, 0.1, 0.7, 0.1, -0.9, 0.35, 0)); bar.add(this.mesh(this.g.box, this.m.dark, 0.1, 0.7, 0.1, 0.9, 0.35, 0));
      for (let i = 0; i < 6; i++) bar.add(this.mesh(this.g.box, i % 2 ? this.m.white : this.m.red, 0.32, 0.3, 0.06, -0.8 + i * 0.32, 0.68, 0)); bar.position.set(3.0, 0, 4.1); bar.rotation.y = -0.3; add(bar);
      // wheelbarrow
      const wb = new T.Group(); wb.add(this.mesh(this.g.box, this.m.green, 0.9, 0.3, 0.55, 0, 0.5, 0)); const wheel = this.mesh(this.g.cyl, this.m.dark, 0.2, 0.1, 0.2, 0.55, 0.22, 0); wheel.rotation.x = Math.PI / 2; wb.add(wheel);
      wb.add(this.mesh(this.g.box, this.m.dark, 0.6, 0.05, 0.05, -0.55, 0.4, 0.2)); wb.add(this.mesh(this.g.box, this.m.dark, 0.6, 0.05, 0.05, -0.55, 0.4, -0.2)); wb.position.set(-3.6, 0, 3.9); wb.rotation.y = 0.5; add(wb);
      // trees
      for (const [x, z, s] of [[-7.2, -0.6, 1.1], [9.2, 3.0, 1.0], [-8.6, 3.6, 0.8]]) { const t = new T.Group(); t.add(this.mesh(this.g.cyl, this.m.trunk, 0.16 * s, 1.4 * s, 0.16 * s, 0, 0.7 * s, 0)); t.add(this.mesh(this.g.sph, this.m.tree, 0.95 * s, 0.85 * s, 0.95 * s, 0, 1.9 * s, 0)); t.add(this.mesh(this.g.sph, new T.MeshLambertMaterial({ color: 0x8fbd5c }), 0.6 * s, 0.5 * s, 0.6 * s, -0.25 * s, 2.15 * s, 0.2 * s)); t.position.set(x, 0, z); add(t); }
    }
    buildCrane() {
      const T = this.T, root = new T.Group(); root.position.set(CRANE_X, 0, CRANE_Z); this.scene.add(root); this.craneRoot = root;
      root.add(this.mesh(this.g.box, this.m.concrete, 3.2, 0.5, 3.2, 0, 0.25, 0));
      this.posts = []; for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) { const p = this.mesh(this.g.box, this.m.orange, 0.14, 1, 0.14, x, 0.5, z); root.add(p); this.posts.push(p); }
      this.segs = [];
      for (let i = 0; i < 26; i++) {
        const seg = new T.Group(); seg.position.y = i + 0.5; const flip = i % 2 ? 1 : -1, len = Math.hypot(1, 1.0), ang = Math.atan2(1.0, 1);
        for (const [x, z, side] of [[0, -0.5, 'z'], [0, 0.5, 'z'], [-0.5, 0, 'x'], [0.5, 0, 'x']]) { const d = this.mesh(this.g.box, this.m.orangeD, 0.07, len, 0.07, x, 0, z, false); if (side === 'z') d.rotation.z = flip * ang; else d.rotation.x = flip * ang; seg.add(d); }
        seg.add(this.mesh(this.g.box, this.m.orangeD, 1.0, 0.07, 0.07, 0, 0.5, -0.5, false)); seg.add(this.mesh(this.g.box, this.m.orangeD, 1.0, 0.07, 0.07, 0, 0.5, 0.5, false));
        seg.add(this.mesh(this.g.box, this.m.orangeD, 0.07, 0.07, 1.0, -0.5, 0.5, 0, false)); seg.add(this.mesh(this.g.box, this.m.orangeD, 0.07, 0.07, 1.0, 0.5, 0.5, 0, false));
        root.add(seg); this.segs.push(seg);
      }
      // jib (horizontal truss over the tower), counter-jib with weights, cabin, apex, guy wires
      const jib = new T.Group(); root.add(jib); this.jib = jib; const X1 = -12.4, X2 = 4.6, len = X2 - X1, cx = (X1 + X2) / 2;
      for (const z of [-0.5, 0.5]) { jib.add(this.mesh(this.g.box, this.m.orange, len, 0.13, 0.13, cx, 0.55, z)); jib.add(this.mesh(this.g.box, this.m.orange, len, 0.13, 0.13, cx, -0.15, z)); }
      for (let x = X1, k = 0; x < X2 - 0.9; x += 0.9, k++) for (const z of [-0.5, 0.5]) { const d = this.mesh(this.g.box, this.m.orangeD, 0.06, Math.hypot(0.9, 0.7), 0.06, x + 0.45, 0.2, z, false); d.rotation.z = (k % 2 ? 1 : -1) * Math.atan2(0.9, 0.7); jib.add(d); }
      for (let x = X1; x <= X2; x += 1.8) { jib.add(this.mesh(this.g.box, this.m.orangeD, 0.06, 0.06, 1.0, x, 0.55, 0, false)); jib.add(this.mesh(this.g.box, this.m.orangeD, 0.06, 0.06, 1.0, x, -0.15, 0, false)); }
      jib.add(this.mesh(this.g.box, this.m.orange, 1.0, 1.0, 0.85, -1.15, -0.95, 0.15));                      // cabin
      jib.add(this.mesh(this.g.box, this.m.glassC, 0.05, 0.4, 0.55, -1.66, -0.8, 0.15)); jib.add(this.mesh(this.g.box, this.m.glassC, 0.55, 0.4, 0.05, -1.15, -0.8, 0.58));
      for (let i = 0; i < 3; i++) jib.add(this.mesh(this.g.box, this.m.cw, 0.9, 0.7, 1.0, 3.5 - i * 0.95, -0.6, 0));  // counterweights
      const apex = this.mesh(new T.ConeGeometry(0.55, 3.4, 4), this.m.orange, 1, 1, 1, 0, 2.2, 0); apex.rotation.y = Math.PI / 4; jib.add(apex);
      const wire = (x2) => { const g = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 3.9, 0), new T.Vector3(x2, 0.6, 0)]); return new T.Line(g, new T.LineBasicMaterial({ color: 0x9db3c4 })); };
      jib.add(wire(X1 + 0.3)); jib.add(wire(X2 - 0.2));
    }
    buildExtras() {
      const T = this.T;
      // trolley + hanging assembly (hook, cable, ropes)
      const asm = new T.Group(); this.asm = asm; this.scene.add(asm);
      this.trolley = this.mesh(this.g.box, this.m.orangeD, 0.9, 0.32, 0.6, 0, 0, 0); asm.add(this.trolley);
      this.cable = this.mesh(this.g.cyl, this.m.dark, 0.035, 1, 0.035, 0, -0.5, 0, false); asm.add(this.cable);
      this.hookBlock = this.mesh(this.g.box, this.m.orange, 0.34, 0.34, 0.34, 0, -1, 0); asm.add(this.hookBlock);
      this.hookRing = this.mesh(new T.TorusGeometry(0.16, 0.045, 8, 16, 4.6), this.m.dark, 1, 1, 1, 0, -1.3, 0); this.hookRing.rotation.z = -0.8; asm.add(this.hookRing);
      this.rope = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(24), 3)), new T.LineBasicMaterial({ color: 0x586a7c })); this.rope.frustumCulled = false; asm.add(this.rope);
      // landing target: dashed green frame on the ground of the drop zone + arrow
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
      x.lineWidth = 12; x.strokeStyle = '#22c55e'; x.setLineDash([34, 22]); x.lineJoin = 'round'; x.shadowColor = '#22c55e'; x.shadowBlur = 18; x.strokeRect(34, 34, 188, 188); x.fillStyle = 'rgba(34,197,94,.16)'; x.fillRect(40, 40, 176, 176);
      this.targetMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0 }); this.target = new T.Mesh(this.g.plane, this.targetMat); this.target.scale.set(2.9, 2.9, 1); this.target.rotation.x = -Math.PI / 2; this.scene.add(this.target);
      this.arrow = new T.Mesh(new T.ConeGeometry(0.28, 0.6, 12), new T.MeshBasicMaterial({ color: 0x16a34a })); this.arrow.rotation.x = Math.PI; this.arrow.visible = false; this.scene.add(this.arrow);
      // multiplier badge (sprite with a canvas texture)
      this.badgeCv = document.createElement('canvas'); this.badgeCv.width = 256; this.badgeCv.height = 96; this.badgeTex = new T.CanvasTexture(this.badgeCv);
      this.badge = new T.Sprite(new T.SpriteMaterial({ map: this.badgeTex, transparent: true, depthTest: false })); this.badge.scale.set(2.2, 0.82, 1); this.badge.visible = false; this.badge.renderOrder = 10; this.scene.add(this.badge);
      // dust puffs pool
      const pc = document.createElement('canvas'); pc.width = pc.height = 64; const px = pc.getContext('2d'), pg = px.createRadialGradient(32, 32, 0, 32, 32, 32); pg.addColorStop(0, 'rgba(255,250,240,.9)'); pg.addColorStop(1, 'rgba(255,250,240,0)'); px.fillStyle = pg; px.fillRect(0, 0, 64, 64);
      const pt = new T.CanvasTexture(pc); this.puffs = []; for (let i = 0; i < 28; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: pt, transparent: true, depthWrite: false })); s.visible = false; this.scene.add(s); this.puffs.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 }); }
    }
    makeHouse(ci) {
      const T = this.T, g = new T.Group(), wallsH = 1.1, roofT = 0.14;
      g.add(this.mesh(this.g.box, this.m.walls[ci % 5], 2.0, wallsH, 2.0, 0, -HALF + wallsH / 2, 0)); g.add(this.mesh(this.g.box, this.m.roof, 2.14, roofT, 2.14, 0, HALF - roofT / 2, 0));
      const wy = -0.1;
      const face = (rot, windows, door) => {
        const f = new T.Group(); f.rotation.y = rot;
        for (const ox of windows) {
          f.add(this.mesh(this.g.plane, this.m.frame, 0.5, 0.58, 1, ox, wy, 1.004, false)); f.add(this.mesh(this.g.plane, this.m.glass, 0.4, 0.48, 1, ox, wy, 1.007, false));
          f.add(this.mesh(this.g.plane, this.m.frame, 0.4, 0.035, 1, ox, wy, 1.01, false)); f.add(this.mesh(this.g.plane, this.m.frame, 0.035, 0.48, 1, ox, wy, 1.01, false));
        }
        if (door) { f.add(this.mesh(this.g.plane, this.m.frame, 0.6, 0.92, 1, 0, -HALF + 0.46, 1.004, false)); f.add(this.mesh(this.g.plane, this.m.door, 0.5, 0.86, 1, 0, -HALF + 0.43, 1.008, false)); f.add(this.mesh(this.g.sph, this.m.knob, 0.035, 0.035, 0.035, 0.17, -HALF + 0.42, 1.02, false)); }
        g.add(f);
      };
      face(0, [-0.68, 0.68], true); face(Math.PI, [-0.45, 0.45], false); face(Math.PI / 2, [-0.45, 0.45], false); face(-Math.PI / 2, [-0.45, 0.45], false);
      return g;
    }

    // ---------------------------------------------------------------- state
    reset() {
      for (const f of this.floors || []) this.houseGroup.remove(f); for (const o of [this.fall?.obj, this.hang, this.tumble?.obj, this.restObj]) if (o?.parent) o.parent.remove(o);
      this.state = 'idle'; this.u = 0; this.floors = []; this.landed = 0; this.targetSucc = 0; this.queue = []; this.failQueued = false; this.wob = 0; this.wv = 0; this.th = 0; this.thv = 0; this.sw = 0;
      this.trolleyX = 0; this.L = 0.25; this.hookStart = 0.25; this.fall = null; this.hang = null; this.tumble = null; this.restObj = null; this.roundStatus = 'idle'; this.maxSteps = 10; this.mults = []; this.badgeT = 0; this.badgeText = '';
      this.badge.visible = false;
    }
    resize() {
      const w = this.c.clientWidth || 360, h = this.c.clientHeight || 440; this.r.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.aspect = w / h;
    }
    sync(round) {
      if (!round) { if (this.roundId !== null) { this.reset(); this.roundId = null; } this._setReady(false); return; }
      const v = round.view, succ = round.status === 'lost' ? v.picks.length - 1 : v.picks.length;
      if (round.id !== this.roundId) {                       // a different round: rebuild the tower from its state, no animation
        this.reset(); this.roundId = round.id;
        for (let i = 0; i < succ; i++) { const h = this.makeHouse(this.ci++); h.position.set(0, PLAT_TOP + i * INC + HALF, 0); this.houseGroup.add(h); this.floors.push(h); }
        this.landed = this.targetSucc = succ;
        if (round.status === 'active') { this.state = 'arrive'; this.newHang(); }
        else { this.state = 'done'; if (round.status === 'lost') { this.failQueued = true; const h = this.makeHouse(this.ci++); h.position.set(3.6, 1.0, 0.6); h.rotation.z = -Math.PI / 2; this.scene.add(h); this.restObj = h; } }
        this.jibY = this.jibTarget(); this.camTy = 6;
      }
      this.maxSteps = v.maxSteps; this.mults = v.multipliers; this.roundStatus = round.status;
      while (this.targetSucc < succ) { this.queue.push({ ok: true }); this.targetSucc++; }
      if (round.status === 'lost' && !this.failQueued) { this.queue.push({ ok: false, side: Math.random() < 0.5 ? -1 : 1 }); this.failQueued = true; }
      if (round.status === 'won' && !this.queue.length && (this.state === 'sway' || this.state === 'arrive')) { this.state = 'leave'; this.u = 0; this.hookStart = this.L; }
      this.updateBadge();
    }
    newHang() { if (this.hang?.parent) this.hang.parent.remove(this.hang); this.hang = this.makeHouse(this.ci++); this.asm.add(this.hang); this.hang.scale.setScalar(0.01); }
    // The house leaves the hook at the moment of the tap and flies on with the crane's and the pendulum's momentum.
    release(item) {
      const obj = this.hang; if (!obj) return; this.scene.attach(obj); this.hang = null;
      const rel = obj.position.x, side = Math.abs(rel) < 0.25 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(rel);
      const r = this.L + HOOKH + ROPE + HALF, vx = this.trolleyVx + r * Math.cos(this.th) * this.thv;
      const ox = clamp(rel * 0.24 + vx * 0.03, -0.38, 0.38), tilt = clamp(-rel * 0.03 - vx * 0.004, -0.075, 0.075);
      this.fall = { obj, vy: 0, vx, ok: item ? item.ok : null, side, ox, tilt, wait: 0 };
      this.hookStart = this.L; this.state = 'drop'; this.u = 0; this.thv *= 0.35;
    }
    tap() { if (this.state === 'sway' && this.roundStatus === 'active' && this.hang && !this.fall) this.release(null); }
    _setReady(v) { if (v !== this._ready) { this._ready = v; this.onReady?.(v); } }
    jibTarget() { return Math.max(13.8, PLAT_TOP + this.landed * INC + 6.4); }
    updateBadge() {
      const n = this.landed, txt = n && this.mults[n - 1] != null ? 'x' + this.mults[n - 1].toFixed(2) : '';
      if (txt === this.badgeText) return; this.badgeText = txt; this.badgeT = 1;
      if (!txt) { this.badge.visible = false; return; }
      const x = this.badgeCv.getContext('2d'); x.clearRect(0, 0, 256, 96); x.fillStyle = '#22c55e'; x.beginPath(); x.roundRect ? x.roundRect(8, 8, 240, 80, 40) : x.rect(8, 8, 240, 80); x.fill();
      x.fillStyle = '#fff'; x.font = "800 46px 'Unbounded',system-ui,sans-serif"; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 50); this.badgeTex.needsUpdate = true; this.badge.visible = true;
    }
    puff(x, y, z, n = 8) { let k = 0; for (const p of this.puffs) { if (p.life > 0 || k >= n) continue; p.life = p.max = rand(0.45, 0.9); p.vx = rand(-1.6, 1.6); p.vy = rand(0.2, 1.1); p.vz = rand(-1.2, 1.2); p.size = rand(0.5, 0.95); p.s.position.set(x + rand(-0.6, 0.6), y, z + rand(-0.6, 0.6)); p.s.visible = true; k++; } }

    // ---------------------------------------------------------------- loop
    _loop(now) {
      if (!this.c.isConnected) { this.r.dispose(); this._ro.disconnect(); return; }
      requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.update(dt, now / 1000); this.r.render(this.scene, this.camera);
    }
    update(dt, t) {
      const A = 1.5, OM = (Math.PI * 2) / 3.4, om2 = 24, damp = 1.9, ropeLen = 66 / 22;
      this.jibY += (this.jibTarget() - this.jibY) * (dt === 0 ? 1 : Math.min(1, dt * 2.2));
      const trolleyY = this.jibY - 0.4, landBottom = PLAT_TOP + this.landed * INC, hoverCenter = landBottom + HALF + 2.2;
      const Lhover = trolleyY - (hoverCenter + HALF + ROPE) - HOOKH, Lhide = 0.3;
      this.u += dt; this.sw += dt;
      let L = this.L, ax = 0, hasHouse = !!this.hang && ['arrive', 'sway', 'leave'].includes(this.state);
      const swayPos = (time, amp) => A * amp * Math.sin(OM * time);
      this.trolleyVx = this.prevTx === undefined ? 0 : (this.trolleyX - this.prevTx) / Math.max(dt, 1e-3); 
      switch (this.state) {
        case 'arrive': { const k = sm(clamp(this.u / 1.1)); L = lerp(Lhide, Lhover, k); this.trolleyX = swayPos(this.sw, k); ax = -A * k * OM * OM * Math.sin(OM * this.sw); if (this.hang) this.hang.scale.setScalar(clamp(this.u / 0.35, 0.01, 1)); if (this.u >= 1.1) { this.state = 'sway'; this.u = 0; } break; }
        case 'sway': { L = Lhover; this.trolleyX = swayPos(this.sw, 1); ax = -A * OM * OM * Math.sin(OM * this.sw);
          if (this.queue.length && this.hang) this.release(this.queue.shift()); break; }      // result arrived without a tap (e.g. resumed round): release now
        case 'drop': case 'land': case 'tumble': {
          this.trolleyX = swayPos(this.sw, 1); ax = -A * OM * OM * Math.sin(OM * this.sw);
          L = lerp(this.hookStart, Lhide, sm(clamp((this.u - 0.05) / 0.85)));
          const f = this.fall;
          if (f) {
            if (f.ok === null && this.queue.length) f.ok = this.queue.shift().ok;                // the server's verdict
            const o = f.obj; f.vy -= 28 * dt; o.position.y += f.vy * dt;
            f.vx *= Math.exp(-5 * dt); o.position.x += f.vx * dt;
            const tx = f.ok === false ? f.side * 1.0 : f.ox;                                       // a failing house comes down on the platform's edge
            o.position.x = lerp(o.position.x, tx, clamp(dt * 4.5)); o.position.z = lerp(o.position.z, 0, clamp(dt * 6));
            o.rotation.z = lerp(o.rotation.z, f.ok === false ? -f.side * 0.22 : f.tilt, clamp(dt * 7)); o.rotation.y *= 0.92;
            if (o.position.y - HALF <= landBottom) {
              if (f.ok === null) { o.position.y = landBottom + HALF; f.vy = 0; f.wait += dt; if (f.wait > 2.5) { this.scene.remove(o); this.fall = null; this.state = 'arrive'; this.u = 0; this.newHang(); } }
              else if (f.ok) {
                const impact = -f.vy; o.position.set(f.ox, landBottom + HALF, 0); o.rotation.set(0, 0, f.tilt - f.side * 0.045); o.userData = { ox: f.ox, tilt: f.tilt, sq: clamp(impact / 120, 0.03, 0.1) };
                this.floors.push(o); this.houseGroup.add(o); this.landed++; this.fall = null; this.wv += 1.4 + impact * 0.1 + this.landed * 0.1; this.puff(f.ox, landBottom + 0.1, 0, 10); this.thv += 0.3 * f.side; this.state = 'land'; this.updateBadge();
              } else {
                this.tumble = { obj: o, side: f.side, vx: f.side * 3.0, vy: 3.6, vr: -f.side * 3.0, hit: 0 }; this.fall = null; this.wv += f.side * 3.4; this.puff(o.position.x, landBottom + 0.1, 0, 8); this.state = 'tumble';
              }
            }
          }
          const q = this.tumble;
          if (q) {
            const o = q.obj; q.vy -= 28 * dt; o.position.x += q.vx * dt; o.position.y += q.vy * dt; o.rotation.z += q.vr * dt;
            const sup = (x) => (Math.abs(x) < 1.25 ? landBottom : Math.abs(x) < 2.35 ? PLAT_TOP : 0);   // top of the tower, the platform, the ground
            const contact = sup(o.position.x), low = Math.abs(Math.sin(o.rotation.z)) * 1.0 + Math.abs(Math.cos(o.rotation.z)) * HALF;
            if (o.position.y - low <= contact && q.vy < 0) {
              o.position.y = contact + low; q.hit++; this.puff(o.position.x, contact + 0.1, o.position.z, 8); this.wv += -Math.sign(q.vx) * 0.6;
              if (q.hit >= 3 || (q.hit >= 2 && Math.abs(q.vy) < 3.2)) { const r = -q.side * (Math.PI / 2), c2 = sup(o.position.x); o.rotation.z = r; o.position.y = c2 + Math.abs(Math.sin(r)) + Math.abs(Math.cos(r)) * HALF; this.restObj = o; this.tumble = null; this.state = 'done'; this.u = 0; this.puff(o.position.x, c2 + 0.1, 0, 6); }
              else { q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.55; }
            }
          }
          if (this.state === 'land' && this.u > 1.05) { if (this.roundStatus === 'active' && this.landed < this.maxSteps) { this.state = 'arrive'; this.u = 0; this.newHang(); } else this.state = 'done'; }
          break; }
        case 'leave': { L = lerp(this.hookStart, Lhide, sm(clamp(this.u / 0.9))); if (this.hang) this.hang.scale.setScalar(clamp(1.35 - this.u / 0.9 * 1.3, 0.01, 1)); if (this.u >= 0.9) { if (this.hang) { this.asm.remove(this.hang); this.hang = null; } this.state = 'done'; this.u = 0; } break; }
        default: L = lerp(L, Lhide, clamp(dt * 3));
      }
      this.prevTx = this.trolleyX;
      this.L = L;

      // pendulum driven by the trolley, soft spring for the tower
      if (hasHouse) { const acc = -om2 * Math.sin(this.th) - 0.22 * (ax / ropeLen) * Math.cos(this.th) - damp * this.thv; this.thv += acc * dt; this.th = clamp(this.th + this.thv * dt, -0.25, 0.25); } else { this.thv *= 0.9; this.th *= 0.92; }
      this.wv += (-60 * this.wob - 5.5 * this.wv) * dt; this.wob += this.wv * dt;

      // crane pose
      const asm = this.asm; asm.position.set(this.trolleyX, trolleyY, 0); asm.rotation.z = this.th;
      this.cable.scale.y = Math.max(0.05, L); this.cable.position.y = -L / 2; this.hookBlock.position.y = -L - 0.17; this.hookRing.position.y = -L - 0.5;
      const ringY = -(L + HOOKH), roofY = -(L + HOOKH + ROPE), p = this.rope.geometry.attributes.position, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let i = 0; i < 4; i++) { p.setXYZ(i * 2, 0, ringY, 0); p.setXYZ(i * 2 + 1, c[i][0] * 0.95, roofY, c[i][1] * 0.95); } p.needsUpdate = true; this.rope.visible = hasHouse;
      if (this.hang) this.hang.position.set(0, roofY - HALF, 0);
      this.trolley.position.y = 0; this.jib.position.y = this.jibY;
      for (const post of this.posts) { post.scale.y = this.jibY; post.position.y = this.jibY / 2; } this.segs.forEach((s, i) => { s.visible = i + 1 <= this.jibY - 0.2; });

      // tower wobble
      this.floors.forEach((f, i) => {
        const k = this.floors.length > 1 ? i / (this.floors.length - 1) : 1, u = f.userData || {}, sq = u.sq || 0;
        f.position.x = (u.ox || 0) + this.wob * (0.1 + 0.9 * k); f.rotation.z = lerp(f.rotation.z, (u.tilt || 0) - this.wob * 0.035 * k, clamp(dt * 9));   // settles into a slight lean and stays there
        if (sq) { u.sq = sq * Math.exp(-9 * dt); f.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5); if (u.sq < 0.002) { u.sq = 0; f.scale.set(1, 1, 1); } }
      });
      // lamps, drop zone, arrow, badge, dust
      this.lamps.forEach((l, i) => { l.material.color.setHex(Math.sin(t * 4 + i * 1.6) > 0 ? 0xffd23f : 0x6b5a1c); });
      const show = ['arrive', 'sway', 'align'].includes(this.state) && this.roundStatus === 'active', pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
      this.targetMat.opacity = lerp(this.targetMat.opacity, show ? 0.65 + 0.35 * pulse : 0, clamp(dt * 8)); this.target.position.set(0, landBottom + 0.03, 0); this.target.rotation.z = 0;
      this.arrow.visible = show; this.arrow.position.set(0, landBottom + 1.15 + pulse * 0.25, 0);
      if (this.landed && this.badge.visible) { this.badgeT = Math.max(0, this.badgeT - dt * 0.7); const top = PLAT_TOP + this.landed * INC; this.badge.position.set(1.9 + this.wob * 0.9, top - 0.5, 1.4); this.badge.scale.set(2.2 * (1 + this.badgeT * 0.3), 0.82 * (1 + this.badgeT * 0.3), 1); }
      for (const q of this.puffs) { if (q.life <= 0) continue; q.life -= dt; if (q.life <= 0) { q.s.visible = false; continue; } const a = q.life / q.max; q.s.position.x += q.vx * dt; q.s.position.y += q.vy * dt; q.s.position.z += q.vz * dt; q.s.scale.setScalar(q.size * (2.2 - a)); q.s.material.opacity = 0.75 * a; }

      // camera: follows the tower, dollies out when it gets tall
      const topNext = PLAT_TOP + this.landed * INC + 3.2, yLow = Math.max(-1.1, topNext - 12.5), yHigh = this.jibY + 1.7;
      const Hv = Math.max(21, yHigh - yLow, 16.5 / this.aspect), ty = Math.max(yLow + Hv / 2 - 0.2, (yLow + yHigh) / 2);
      const ke = dt === 0 ? 1 : Math.min(1, dt * 2.2); this.camTy += (ty - this.camTy) * ke; this.camH += (Hv - this.camH) * ke;
      const dist = this.camH / 2 / Math.tan((this.camera.fov * Math.PI) / 360), cx = 0.9, ce = Math.cos(this.el);
      this.camera.position.set(cx + dist * Math.sin(this.az) * ce, this.camTy + dist * Math.sin(this.el), dist * Math.cos(this.az) * ce); this.camera.lookAt(cx, this.camTy, 0);
      this.sun.position.set(-9, this.camTy + 12, 10); this.sun.target.position.set(0, this.camTy - 2, 0); this.sun.target.updateMatrixWorld();
      this._setReady(this.state === 'sway' && this.roundStatus === 'active' && !this.queue.length);
    }
  }
  window.TowerGame3D = TowerGame3D;
})();
