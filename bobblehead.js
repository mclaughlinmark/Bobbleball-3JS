import * as THREE from 'three';

// ---------- Vintage bobblehead player doll ----------
// A procedural (all-primitives) recreation of a 1960s-style baseball bobblehead:
// oversized cherub head on a spring, chubby short body, cap with brim, short
// jersey sleeves over navy undersleeves. Built as a THREE.Group of named parts
// with free-pivoting arms, legs, and head so gameplay code can animate swings,
// throws, fielding — and keep the head wobbling the whole time.
//
// Anatomy of the returned rig (all pivots are proper Groups):
//   root                 — feet at y=0, faces +Z
//   ├─ leftLeg/rightLeg  — pivot at the hip (rotate X to stride)
//   ├─ torso             — jersey, belt, neck (static meshes)
//   ├─ leftArm/rightArm  — pivot at the shoulder (rotate X/Z to swing/throw)
//   └─ headPivot         — pivot at the neck; the whole head+cap+face hangs
//                          from this, and the bobble spring drives its tilt
//
// Team color goes on the jersey, sleeves, and cap; pants stay cream, accents
// (undersleeves, socks, belt) stay navy, skin/shoes/hair fixed — so a white
// (home) and a red (visitor) doll read at a glance like the current capsules.

export const BOBBLE_HEIGHT = 2.55; // ground to top of cap, world units (≈ the old capsule height)

// Fixed palette (everything but the team color)
const SKIN       = 0xe8a97e;
const SKIN_SHADE = 0xd98f63;
const NAVY       = 0x20304e; // undersleeves, socks, belt
const SHOE       = 0x1a1a24;
const HAIR       = 0x3a2a1e;
const CREAM      = 0xf2e6cf; // pants
const CHEEK      = 0xe07b62;
const MOUTH      = 0x8a4a3a;
const IRIS       = 0x5a7a9a;

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
}

function add(parent, geo, material, x, y, z) {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// One leg, pivoted at the hip: cream pant, navy sock, black shoe.
function buildLeg(side) { // side: -1 = left, +1 = right
  const leg = new THREE.Group();
  add(leg, new THREE.CylinderGeometry(0.14, 0.155, 0.34, 12), mat(CREAM), 0, -0.17, 0);
  add(leg, new THREE.CylinderGeometry(0.11, 0.115, 0.21, 12), mat(NAVY), 0, -0.43, 0);
  const shoe = add(leg, new THREE.SphereGeometry(0.16, 16, 12), mat(SHOE, { roughness: 0.4 }), 0, -0.53, 0.06);
  shoe.scale.set(1, 0.55, 1.55);
  return leg;
}

// One arm, pivoted at the shoulder, hanging straight down in rest pose.
// Built from a rounded shoulder ball and overlapping capsules of shrinking
// radius so the whole limb tapers smoothly — no hard cylinder rims.
function buildArm(side, jerseyMat) {
  const arm = new THREE.Group();
  add(arm, new THREE.SphereGeometry(0.14, 18, 14), jerseyMat, 0, -0.04, 0);           // rounded shoulder
  add(arm, new THREE.CapsuleGeometry(0.12, 0.16, 6, 16), jerseyMat, 0, -0.15, 0);     // jersey sleeve
  add(arm, new THREE.CapsuleGeometry(0.09, 0.14, 6, 16), mat(NAVY), 0, -0.32, 0);     // navy undersleeve
  add(arm, new THREE.CapsuleGeometry(0.075, 0.14, 6, 16), mat(SKIN), 0, -0.46, 0);    // forearm
  add(arm, new THREE.SphereGeometry(0.09, 16, 12), mat(SKIN), 0, -0.59, 0);           // hand
  arm.rotation.z = side * -0.10; // rest a touch out from the body
  return arm;
}

// The big cherub head with cap, hung from the neck pivot. Face looks down +Z.
function buildHead(teamMat) {
  const head = new THREE.Group();
  const R = 0.58;         // head radius — deliberately huge, it's a bobblehead
  const hy = 0.54;        // head center height above the neck pivot

  const skull = add(head, new THREE.SphereGeometry(R, 32, 24), mat(SKIN), 0, hy, 0);
  skull.scale.y = 0.95;

  // Hair: a slim dark band peeking out under the cap's edge, all the way
  // around — high on the skull, well above the eyebrows...
  const hairMat = mat(HAIR, { roughness: 0.85 });
  add(head, new THREE.SphereGeometry(R * 1.01, 32, 8, 0, Math.PI * 2, Math.PI * 0.24, Math.PI * 0.11),
    hairMat, 0, hy, 0).scale.y = 0.95;
  // ...plus full coverage down the back and sides of the skull to ear height,
  // like the reference doll (phi sweep centered on -Z, the back of the head).
  add(head, new THREE.SphereGeometry(R * 1.01, 32, 10, Math.PI * 0.95, Math.PI * 1.10, Math.PI * 0.30, Math.PI * 0.24),
    hairMat, 0, hy, 0).scale.y = 0.95;

  // Cap: dome over the top of the skull, curved brim, button on top.
  add(head, new THREE.SphereGeometry(R * 1.045, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.34), teamMat, 0, hy, 0);
  // Brim: a ~110° front section of a flattened torus whose inner edge tucks up
  // under the cap's rim — the crown curls outward into a curved crescent brim,
  // not a bolted-on disc. Kept high enough to clear the eyebrows.
  const BRIM_ARC = Math.PI * 0.62;
  const brimGroup = new THREE.Group();
  brimGroup.position.set(0, hy + 0.30, 0.02);
  brimGroup.rotation.x = 0.12; // gentle dip toward the front
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.17, 10, 24, BRIM_ARC), teamMat);
  // Center the arc on +Z: spin it in-plane first (Z), then lay it flat (X) —
  // Euler XYZ applies the Z rotation to the geometry first.
  brim.rotation.set(Math.PI / 2, 0, Math.PI / 2 - BRIM_ARC / 2);
  brim.scale.set(1, 1, 0.26);  // flatten the tube into a thin curved blade
  brim.castShadow = true;
  brimGroup.add(brim);
  head.add(brimGroup);
  add(head, new THREE.SphereGeometry(0.05, 10, 8), teamMat, 0, hy + R * 1.02, 0);

  // ---- Face contour: one smooth lower-face ellipsoid blended into the skull ----
  // A single wide, chubby volume pushes the cheeks/jaw/chin forward as one
  // continuous curve (multiple small lumps read as jowls and frown-shadows).
  // Features then ride this surface rather than poking out of a bare ball.
  const skinMat = mat(SKIN);
  add(head, new THREE.SphereGeometry(0.46, 28, 20), skinMat, 0, hy - 0.16, 0.16)
    .scale.set(1.04, 0.78, 0.95);

  // Ears
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.09, 12, 10), skinMat, s * R * 0.97, hy - 0.02, 0.05)
      .scale.set(0.6, 1, 0.8);
  }

  // Eyes: wide-set and big, nearly flush with the face — flattened whites
  // that barely rise off the surface, like paint on the doll.
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.105, 14, 12), mat(0xffffff, { roughness: 0.35 }), s * 0.20, hy + 0.05, 0.51)
      .scale.set(1, 1.2, 0.4);
    add(head, new THREE.SphereGeometry(0.048, 10, 8), mat(IRIS, { roughness: 0.35 }), s * 0.20, hy + 0.05, 0.548)
      .scale.z = 0.45;
    add(head, new THREE.SphereGeometry(0.024, 8, 6), mat(0x111111, { roughness: 0.3 }), s * 0.20, hy + 0.05, 0.567)
      .scale.z = 0.5;
    // Eyebrow: thin slab hugging the brow line
    const brow = add(head, new THREE.BoxGeometry(0.17, 0.032, 0.022), mat(HAIR), s * 0.20, hy + 0.21, 0.53);
    brow.rotation.z = s * -0.18;
  }

  // Nose: small shaded button riding the crest of the face curve
  add(head, new THREE.SphereGeometry(0.05, 12, 10), mat(SKIN_SHADE), 0, hy - 0.04, 0.585)
    .scale.z = 0.7;

  // Smile: a short, shallow arc pressed lightly onto the lower-face curve.
  // Kept small and flat so its ends don't dive into the face while the middle
  // juts out — it should sit on the surface like a painted mouth.
  const smile = add(head, new THREE.TorusGeometry(0.115, 0.02, 8, 20, Math.PI * 0.6), mat(MOUTH), 0, hy - 0.155, 0.59);
  smile.rotation.z = -Math.PI / 2 - (Math.PI * 0.6) / 2; // arc through the bottom = upturned smile
  smile.rotation.x = 0.18;  // follow the face's forward curl
  smile.scale.z = 0.3;

  // Rosy cheeks: small, subtle translucent blush pads riding the cheek curve
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.085, 12, 10),
      mat(CHEEK, { transparent: true, opacity: 0.35, roughness: 0.9 }), s * 0.26, hy - 0.13, 0.53)
      .scale.set(1, 0.8, 0.3);
  }

  return head;
}

// Builds one doll. Returns { root, head parts and limb pivots, plus per-doll
// bobble spring state } — pass the whole rig to updateBobble() each frame.
export function buildBobblehead(teamColor) {
  const root = new THREE.Group();
  const teamMat = mat(teamColor, { roughness: 0.55 });

  // Legs (hip pivots)
  const leftLeg = buildLeg(-1);
  leftLeg.position.set(-0.17, 0.62, 0);
  const rightLeg = buildLeg(1);
  rightLeg.position.set(0.17, 0.62, 0);
  root.add(leftLeg, rightLeg);

  // Torso: tapered jersey with a domed top so the shoulder line rolls smoothly
  // into the neck instead of ending at a flat cylinder rim; belt; neck.
  const torso = new THREE.Group();
  add(torso, new THREE.CylinderGeometry(0.30, 0.345, 0.70, 24), teamMat, 0, 0.97, 0);
  add(torso, new THREE.SphereGeometry(0.30, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), teamMat, 0, 1.32, 0)
    .scale.y = 0.55; // shoulder dome
  add(torso, new THREE.CylinderGeometry(0.35, 0.35, 0.09, 18), mat(NAVY), 0, 0.66, 0);
  add(torso, new THREE.CylinderGeometry(0.12, 0.13, 0.12, 12), mat(SKIN), 0, 1.38, 0);
  root.add(torso);

  // Arms (shoulder pivots) — tucked slightly under the shoulder dome so the
  // shoulder balls roll out of the torso instead of perching on top of it.
  const leftArm = buildArm(-1, teamMat);
  leftArm.position.set(-0.315, 1.20, 0);
  const rightArm = buildArm(1, teamMat);
  rightArm.position.set(0.315, 1.20, 0);
  root.add(leftArm, rightArm);

  // Head on its bobble pivot at the neck
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.42, 0);
  headPivot.add(buildHead(teamMat));
  root.add(headPivot);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    root, headPivot, leftArm, rightArm, leftLeg, rightLeg, torso, teamMat,
    // Bobble spring state: tilt angle + angular velocity on two axes,
    // plus a phase offset so a field of dolls doesn't wobble in unison.
    bobble: { ax: 0, vx: 0, az: 0, vz: 0, phase: Math.random() * Math.PI * 2, t: 0 },
  };
}

// Spring-driven head wobble. Call every frame.
//   dt        — seconds since last frame
//   agitation — 0 = idle (gentle ambient sway), 1+ = running/swinging (bigger wobble)
// Gameplay code can also call nudgeBobble() for a one-off impulse (contact, catch).
const SPRING_K = 60;  // stiffness — vintage dolls have a quick, springy wobble
const SPRING_C = 1.8; // damping — low enough to keep ringing for a while
export function updateBobble(doll, dt, agitation = 0) {
  const b = doll.bobble;
  b.t += dt;
  // Ambient sway: continuous figure-eight drive so it never sits dead still.
  // Sized against the spring stiffness for a visible ~3° idle nod (steady-state
  // tilt ≈ drive / (K - ω²)), swelling to ~15° when running or swinging.
  const drive = 1.8 + agitation * 7;
  const fx = Math.sin(b.t * 5.1 + b.phase) * drive;
  const fz = Math.cos(b.t * 4.3 + b.phase) * drive * 0.8;
  b.vx += (-SPRING_K * b.ax - SPRING_C * b.vx + fx) * dt;
  b.vz += (-SPRING_K * b.az - SPRING_C * b.vz + fz) * dt;
  b.ax += b.vx * dt;
  b.az += b.vz * dt;
  doll.headPivot.rotation.x = b.ax;
  doll.headPivot.rotation.z = b.az;
}

// One-off impulse to the head spring (bat contact, hard stop at a bag, a catch).
// strength 1 kicks the head to roughly a 20° wobble that rings down over a couple
// of seconds — the classic flick-the-bobblehead response.
export function nudgeBobble(doll, strength = 1) {
  const dir = Math.random() * Math.PI * 2;
  doll.bobble.vx += Math.cos(dir) * 2.8 * strength;
  doll.bobble.vz += Math.sin(dir) * 2.8 * strength;
}
