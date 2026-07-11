import * as THREE from "three";

/* ============================================================
   STEP 1: Just the field.
   - 200ft x 200ft playing surface
   - Bases set 60ft apart (standard square diamond)
   - No stripes yet, just plain grass + dirt diamond + bases
   ============================================================ */

// Scale: 1 foot = 0.3 world units (keeps numbers manageable)
const FT = 0.3;
const FIELD_SIZE = 350 * FT;     // 350ft x 350ft (expanded by 150ft)
const BASE_DIST = 60 * FT;       // 60ft between bases

// Diamond corner points (home at origin, going counter-clockwise:
// home -> first -> second -> third -> home)
const HOME   = new THREE.Vector3(0, 0, 0);
const FIRST  = new THREE.Vector3(-BASE_DIST, 0, BASE_DIST);
const SECOND = new THREE.Vector3(0, 0, BASE_DIST * 2);
const THIRD  = new THREE.Vector3(BASE_DIST, 0, BASE_DIST);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8d8);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, FIELD_SIZE * 0.7, -FIELD_SIZE * 0.8);
camera.lookAt(0, 0, BASE_DIST);

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Camera is fully scripted for gameplay (batting view -> ball-follow view),
// so no manual orbit controls here anymore.

// ---------- Lighting ----------
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4d2a, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4d6, 1.3);
sun.position.set(FIELD_SIZE * 0.4, FIELD_SIZE * 0.6, -FIELD_SIZE * 0.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -FIELD_SIZE;
sun.shadow.camera.right = FIELD_SIZE;
sun.shadow.camera.top = FIELD_SIZE;
sun.shadow.camera.bottom = -FIELD_SIZE;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = FIELD_SIZE * 4;
scene.add(sun);

// ---------- Ground (200ft x 200ft grass) ----------
const groundGeo = new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4c8a3a, roughness: 1 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
// Center the field so home plate sits near the front edge, field extends toward outfield
ground.position.set(0, 0, FIELD_SIZE / 2 - BASE_DIST * 0.3);
ground.receiveShadow = true;
scene.add(ground);

// (dirt infield removed per request — grass only)

// ---------- Bases ----------
function makeBase(pos, isHome = false, rotationY = 0) {
  if (isHome) {
    // Regulation home plate: 17" wide square-ish back edge tapering to a point,
    // modeled as a five-sided pentagon shape (flat, sitting on the ground).
    const w = 1.4;   // width of the back edge (left-right)
    const d = 1.4;   // total depth (back edge to the point)
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);              // back-left corner
    shape.lineTo(w / 2, 0);                // back-right corner
    shape.lineTo(w / 2, -d * 0.5);         // right side corner (where it angles in)
    shape.lineTo(0, -d);                   // point, facing the pitcher
    shape.lineTo(-w / 2, -d * 0.5);        // left side corner
    shape.lineTo(-w / 2, 0);

    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.PI; // point of the plate faces the backstop, flat edge faces the pitcher
    mesh.position.set(pos.x, 0.05, pos.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  const size = 1.3;
  const geo = new THREE.BoxGeometry(size, 0.15, size);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos.x, 0.1, pos.z);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// ---------- Dirt batting/home plate area ----------
const homeDirtRadius = 7;
const homeDirt = new THREE.Mesh(
  new THREE.CircleGeometry(homeDirtRadius, 32),
  new THREE.MeshStandardMaterial({ color: 0xb5793c, roughness: 1 })
);
homeDirt.rotation.x = -Math.PI / 2;
homeDirt.position.set(HOME.x, 0.015, HOME.z);
homeDirt.receiveShadow = true;
scene.add(homeDirt);

// First and third base sit entirely in fair territory: the foul line runs along
// the bag's outside edge, not through its middle. Nudge each bag inward,
// perpendicular to its foul line, by half its width plus half the chalk line.
const BASE_SIZE = 1.3;
const FOUL_LINE_WIDTH = 0.15; // matches the foul line geometry below
const bagInset = BASE_SIZE / 2 + FOUL_LINE_WIDTH / 2;
// Inward (fair-side) directions, perpendicular to each foul line.
const FIRST_BAG_POS = FIRST.clone().addScaledVector(new THREE.Vector3(1, 0, 1).normalize(), bagInset);
const THIRD_BAG_POS = THIRD.clone().addScaledVector(new THREE.Vector3(-1, 0, 1).normalize(), bagInset);

// Where the first baseman stands to take a throw: on the inside of the bag
// (the side facing second base), his body barely touching the bag's inner
// edge — a foot on the base for the out. The throw comes to rest here (in his
// glove), not at the base itself.
const FIRST_COVER_POS = (() => {
  const towardSecond = SECOND.clone().sub(FIRST_BAG_POS); // inside of the bag, toward second
  towardSecond.y = 0;
  towardSecond.normalize();
  // The capsule tapers to a point at the ground, so at bag height its silhouette
  // is only ~0.31 wide (vs 0.53 at the waist). Stand close enough that the foot
  // of the capsule visibly overlaps the bag edge, not just the rounded belly.
  return FIRST_BAG_POS.clone().addScaledVector(towardSecond, BASE_SIZE / 2 + 0.15);
})();

makeBase(HOME, true);
makeBase(FIRST_BAG_POS, false, Math.PI / 4);
makeBase(SECOND, false, Math.PI / 4);
makeBase(THIRD_BAG_POS, false, Math.PI / 4);

// ---------- Pitcher's mound (dirt circle at the center of the diamond) ----------
const moundCenter = new THREE.Vector3(
  (HOME.x + FIRST.x + SECOND.x + THIRD.x) / 4,
  0,
  (HOME.z + FIRST.z + SECOND.z + THIRD.z) / 4
);
const moundRadius = 2.7;
const mound = new THREE.Mesh(
  new THREE.CylinderGeometry(moundRadius, moundRadius * 1.15, 0.4, 32),
  new THREE.MeshStandardMaterial({ color: 0xa56a35, roughness: 1 })
);
mound.position.set(moundCenter.x, 0.2, moundCenter.z);
mound.castShadow = true;
mound.receiveShadow = true;
scene.add(mound);

// Small pitcher's rubber on top of the mound
const rubber = new THREE.Mesh(
  new THREE.BoxGeometry(0.6, 0.08, 1.6),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
);
rubber.position.set(moundCenter.x, 0.42, moundCenter.z);
rubber.rotation.y = Math.PI / 2;
rubber.castShadow = true;
scene.add(rubber);

// (base labels removed per request)

// ---------- Batter's boxes & foul lines (chalk, both drawn at the same width) ----------
const CHALK_WIDTH = FOUL_LINE_WIDTH; // 0.15 — boxes and foul lines share one line width
const PLATE_TIP_DEPTH = 1.4;         // home plate's back point, where the foul lines originate
const chalkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

// A single chalk bar laid on the dirt between two ground points (x,z).
function makeChalkSegment(x1, z1, x2, z2, y = 0.03) {
  const from = new THREE.Vector3(x1, 0, z1);
  const to = new THREE.Vector3(x2, 0, z2);
  const length = from.distanceTo(to);
  const dir = new THREE.Vector3().subVectors(to, from).normalize();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(CHALK_WIDTH, 0.04, length), chalkMat);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  mesh.position.copy(from).addScaledVector(dir, length / 2);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// Batter's box footprint (shared by the box outline and the foul-line clipping).
const BOX_WIDTH = 1.2;   // ~4ft
const BOX_LENGTH = 1.8;  // ~6ft
const BOX_GAP = 0.85;    // plate center to the box's inner edge
function batterBoxBounds(xSign) {
  const cx = HOME.x + xSign * (BOX_GAP + BOX_WIDTH / 2);
  const cz = HOME.z - BOX_LENGTH * 0.15;
  return { xmin: cx - BOX_WIDTH / 2, xmax: cx + BOX_WIDTH / 2, zmin: cz - BOX_LENGTH / 2, zmax: cz + BOX_LENGTH / 2 };
}

// Draw a batter's box as four chalk bars. The two long sides run past the corners
// by half a line width so they fill the corner squares — otherwise the outer corner
// (which neither a side nor a cap bar reaches) is left notched out.
function makeBatterBox(xSign) {
  const b = batterBoxBounds(xSign);
  const h = CHALK_WIDTH / 2;
  makeChalkSegment(b.xmin, b.zmin - h, b.xmin, b.zmax + h); // long sides, extended to square off the corners
  makeChalkSegment(b.xmax, b.zmin - h, b.xmax, b.zmax + h);
  makeChalkSegment(b.xmin, b.zmin, b.xmax, b.zmin);         // front/back caps tuck between the sides
  makeChalkSegment(b.xmin, b.zmax, b.xmax, b.zmax);
}
makeBatterBox(1);   // right-handed batter's box
makeBatterBox(-1);  // left-handed batter's box

// Foul lines run from where they exit the batter's box out to the outfield fence —
// so each line visibly starts at the box (no chalk between the plate and the boxes)
// and stops at the wall rather than shooting off to infinity.
// Called after the fence is built so its segments are available to clip against.
function makeFoulLine(throughBase, cornerSign) {
  const tip = new THREE.Vector3(HOME.x, 0, HOME.z - PLATE_TIP_DEPTH);
  const dir = new THREE.Vector3().subVectors(throughBase, tip).normalize();
  // Slab method: the larger of each axis pair is where the ray leaves that slab; the
  // smaller of those two is where it leaves the box — the line's inner (home-side) end.
  const b = batterBoxBounds(cornerSign);
  const tExitX = Math.max((b.xmin - tip.x) / dir.x, (b.xmax - tip.x) / dir.x);
  const tExitZ = Math.max((b.zmin - tip.z) / dir.z, (b.zmax - tip.z) / dir.z);
  const tStart = Math.min(tExitX, tExitZ);
  // Outer end: where the foul ray meets the fence (nearest crossing), else the field edge.
  const far = new THREE.Vector3().copy(tip).addScaledVector(dir, FIELD_SIZE * 2);
  let tEnd = FIELD_SIZE * 1.15;
  for (const seg of fenceSegments) {
    const hit = segmentIntersect2D(tip, far, seg.start, seg.end);
    if (hit) tEnd = Math.min(tEnd, tip.distanceTo(hit.point));
  }
  const length = tEnd - tStart;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(CHALK_WIDTH, 0.04, length), chalkMat);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  mesh.position.copy(tip).addScaledVector(dir, tStart + length / 2);
  mesh.position.y = 0.03;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------- Dirt circles around 1B, 2B, and 3B (same size as the pitcher's mound) ----------
function makeBaseDirtCircle(basePos) {
  const circle = new THREE.Mesh(
    new THREE.CircleGeometry(moundRadius, 32),
    new THREE.MeshStandardMaterial({ color: 0xa56a35, roughness: 1 })
  );
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(basePos.x, 0.012, basePos.z);
  circle.receiveShadow = true;
  scene.add(circle);
}
makeBaseDirtCircle(FIRST_BAG_POS);
makeBaseDirtCircle(SECOND);
makeBaseDirtCircle(THIRD_BAG_POS);

// Collision data for all outfield fence segments (filled in below)
const fenceSegments = [];

// ---------- Outfield wooden fence (down the 3B line, 250ft out, running 175ft) ----------
{
  const fenceHeight = 8 * FT;
  const fenceThickness = 0.5 * FT;
  const startDist = 200 * FT;   // distance from home plate, along the 3B foul line
  const runLength = 175 * FT;   // how far the fence extends from that point

  const dir3B = new THREE.Vector3().subVectors(THIRD, HOME).normalize();
  const fenceStart = new THREE.Vector3().copy(HOME).addScaledVector(dir3B, startDist);

  // Fence runs perpendicular to the 3B line, sweeping toward center field.
  const fenceDir = new THREE.Vector3(-dir3B.z, 0, dir3B.x); // 90° rotation of dir3B (toward center)

  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.95 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.95 });

  // Main fence panel (continuous wood wall)
  const panelGeo = new THREE.BoxGeometry(fenceThickness, fenceHeight, runLength);
  const panel = new THREE.Mesh(panelGeo, fenceMat);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fenceDir);
  panel.quaternion.copy(quat);
  panel.position.copy(fenceStart).addScaledVector(fenceDir, runLength / 2);
  panel.position.y = fenceHeight / 2;
  panel.castShadow = true;
  panel.receiveShadow = true;
  scene.add(panel);
  fenceSegments.push({
    start: fenceStart.clone(),
    end: fenceStart.clone().addScaledVector(fenceDir, runLength),
    thickness: fenceThickness,
    height: fenceHeight,
  });

  // Support posts every ~10ft along the run for a more fence-like look
  const postSpacing = 10 * FT;
  const postCount = Math.floor(runLength / postSpacing) + 1;
  for (let i = 0; i <= postCount; i++) {
    const t = Math.min(i * postSpacing, runLength);
    const postPos = new THREE.Vector3().copy(fenceStart).addScaledVector(fenceDir, t);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(fenceThickness * 1.6, fenceHeight * 1.05, fenceThickness * 1.6),
      postMat
    );
    post.position.set(postPos.x, (fenceHeight * 1.05) / 2, postPos.z);
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);
  }

  // ---------- Second fence segment: turns 45° off the end of the first, runs 75ft ----------
  const fence1End = new THREE.Vector3().copy(fenceStart).addScaledVector(fenceDir, runLength);
  const run2Length = 75 * FT;
  // Rotate fenceDir by 45° (toward center field / further around the diamond)
  const turnAngle = Math.PI / 4;
  const fenceDir2 = new THREE.Vector3(
    fenceDir.x * Math.cos(turnAngle) - fenceDir.z * Math.sin(turnAngle),
    0,
    fenceDir.x * Math.sin(turnAngle) + fenceDir.z * Math.cos(turnAngle)
  ).normalize();

  const panel2Geo = new THREE.BoxGeometry(fenceThickness, fenceHeight, run2Length);
  const panel2 = new THREE.Mesh(panel2Geo, fenceMat);
  const quat2 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fenceDir2);
  panel2.quaternion.copy(quat2);
  panel2.position.copy(fence1End).addScaledVector(fenceDir2, run2Length / 2);
  panel2.position.y = fenceHeight / 2;
  panel2.castShadow = true;
  panel2.receiveShadow = true;
  scene.add(panel2);
  fenceSegments.push({
    start: fence1End.clone(),
    end: fence1End.clone().addScaledVector(fenceDir2, run2Length),
    thickness: fenceThickness,
    height: fenceHeight,
  });

  const post2Count = Math.floor(run2Length / postSpacing) + 1;
  for (let i = 0; i <= post2Count; i++) {
    const t = Math.min(i * postSpacing, run2Length);
    const postPos = new THREE.Vector3().copy(fence1End).addScaledVector(fenceDir2, t);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(fenceThickness * 1.6, fenceHeight * 1.05, fenceThickness * 1.6),
      postMat
    );
    post.position.set(postPos.x, (fenceHeight * 1.05) / 2, postPos.z);
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);
  }

  // ---------- Third fence segment: another 45° turn off the end of the second ----------
  const fence2End = new THREE.Vector3().copy(fence1End).addScaledVector(fenceDir2, run2Length);
  const fenceDir3 = new THREE.Vector3(
    fenceDir2.x * Math.cos(turnAngle) - fenceDir2.z * Math.sin(turnAngle),
    0,
    fenceDir2.x * Math.sin(turnAngle) + fenceDir2.z * Math.cos(turnAngle)
  ).normalize();

  // Figure out how far this segment needs to run to cross past the 1B foul line.
  // 1B foul line: passes through the plate's back tip, heading toward FIRST.
  const tip = new THREE.Vector3(HOME.x, 0, HOME.z - 1.4); // matches plate depth used for foul lines
  const dir1B = new THREE.Vector3().subVectors(FIRST, tip).normalize();

  // Solve for intersection of (fence2End + t*fenceDir3) with (tip + s*dir1B) in the XZ plane.
  function intersect2D(p1, d1, p2, d2) {
    // p1 + t*d1 = p2 + s*d2  -> solve for t
    const denom = d1.x * d2.z - d1.z * d2.x;
    if (Math.abs(denom) < 1e-6) return null;
    const diffX = p2.x - p1.x;
    const diffZ = p2.z - p1.z;
    const t = (diffX * d2.z - diffZ * d2.x) / denom;
    return t;
  }
  const tCross = intersect2D(fence2End, fenceDir3, tip, dir1B);
  const margin = 25 * FT; // run a bit "just past" the foul line
  const run3Length = (tCross !== null && tCross > 0) ? tCross + margin : 75 * FT;

  const panel3Geo = new THREE.BoxGeometry(fenceThickness, fenceHeight, run3Length);
  const panel3 = new THREE.Mesh(panel3Geo, fenceMat);
  const quat3 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fenceDir3);
  panel3.quaternion.copy(quat3);
  panel3.position.copy(fence2End).addScaledVector(fenceDir3, run3Length / 2);
  panel3.position.y = fenceHeight / 2;
  panel3.castShadow = true;
  panel3.receiveShadow = true;
  scene.add(panel3);
  fenceSegments.push({
    start: fence2End.clone(),
    end: fence2End.clone().addScaledVector(fenceDir3, run3Length),
    thickness: fenceThickness,
    height: fenceHeight,
  });

  const post3Count = Math.floor(run3Length / postSpacing) + 1;
  for (let i = 0; i <= post3Count; i++) {
    const t = Math.min(i * postSpacing, run3Length);
    const postPos = new THREE.Vector3().copy(fence2End).addScaledVector(fenceDir3, t);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(fenceThickness * 1.6, fenceHeight * 1.05, fenceThickness * 1.6),
      postMat
    );
    post.position.set(postPos.x, (fenceHeight * 1.05) / 2, postPos.z);
    post.castShadow = true;
    post.receiveShadow = true;
    scene.add(post);
  }
}

// Now that the fence exists, draw the foul lines (they clip against it).
// FIRST sits on the negative-x side, THIRD on the positive-x side.
makeFoulLine(FIRST, -1);
makeFoulLine(THIRD, 1);

// ---------- Player: pitcher (pill/capsule shape, white) on the mound ----------
const PLAYER_RADIUS = 1.05 * 0.5;
const PLAYER_HEIGHT = PLAYER_RADIUS * 2.2; // cylindrical mid-section length (capsule adds the radius caps on top)
const pitcherMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })
);
// Capsule's total height = PLAYER_HEIGHT + 2*PLAYER_RADIUS; sit it on top of the mound
const standHeight = PLAYER_HEIGHT / 2 + PLAYER_RADIUS;
pitcherMesh.position.set(moundCenter.x, standHeight + 0.4, moundCenter.z);
pitcherMesh.castShadow = true;
pitcherMesh.receiveShadow = true;
scene.add(pitcherMesh);

// ---------- Baseball (white sphere, held by the pitcher) ----------
const BALL_RADIUS = 0.22;
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_RADIUS, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
);
const CAPSULE_TOTAL_HEIGHT = PLAYER_HEIGHT + 2 * PLAYER_RADIUS;
const ballHoldHeight = 0.4 + (2 / 3) * CAPSULE_TOTAL_HEIGHT; // two-thirds up from the bottom of the capsule
// Positioned just off the pitcher's hand, like he's holding it
ballMesh.position.set(
  pitcherMesh.position.x + PLAYER_RADIUS * 0.8,
  ballHoldHeight,
  pitcherMesh.position.z - PLAYER_RADIUS * 0.3
);
ballMesh.castShadow = true;
scene.add(ballMesh);

// ---------- Batter (capsule, red) in the left-handed batter's box, holding a bat ----------
const batterMesh = new THREE.Mesh(
  new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 8, 16),
  new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.55 })
);
// Left-handed batter's box center (matches makeBatterBox(-1) placement)
const lhBoxGap = 0.85, lhBoxWidth = 1.2, lhBoxLength = 1.8;
const batterPos = new THREE.Vector3(
  HOME.x - (lhBoxGap + lhBoxWidth / 2),
  standHeight,
  HOME.z - lhBoxLength * 0.15
);
batterMesh.position.copy(batterPos);
batterMesh.castShadow = true;
batterMesh.receiveShadow = true;
scene.add(batterMesh);

// Wooden bat, held out toward home plate, pivoting from the batter's hands
const batGroup = new THREE.Group();
const batLength = 2.3;
const batGeo = new THREE.CylinderGeometry(0.18, 0.07, batLength, 12); // thick(barrel) far end, thin(handle) near batter
const batMat = new THREE.MeshStandardMaterial({ color: 0xc9a063, roughness: 0.6 });
const batMesh = new THREE.Mesh(batGeo, batMat);
batMesh.rotation.x = Math.PI / 2;      // lay the cylinder so it points outward
batMesh.position.z = batLength / 2;    // offset so the handle is at the group's origin
batMesh.castShadow = true;
batGroup.add(batMesh);
batGroup.position.set(batterPos.x, (2 / 3) * CAPSULE_TOTAL_HEIGHT, batterPos.z);
// Resting angle: bat starts back behind home plate (toward the backstop),
// swings forward through the plate, ending pointed toward first base.
const BAT_REST_ROT = (Math.PI / 2.5) * 1.33 * 1.25;
const BAT_SWING_ROT = -Math.PI / 2.2;
batGroup.rotation.y = BAT_REST_ROT;
scene.add(batGroup);

// ---------- Swing mechanic: Enter swings the bat and checks for a ball collision ----------
const swing = {
  active: false,
  t: 0,
  duration: 0.4, // seconds for a full swing — long enough that an early swing can still catch up to the ball
};
const HIT_RADIUS = 1.6; // how close the ball needs to be to the bat's sweet spot to count as a hit

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    e.preventDefault();
    if (!swing.active) {
      swing.active = true;
      swing.t = 0;
      if (pitch.inFlight) swungThisPitch = true;
    }
  }
});

function getBatSweetSpotWorld() {
  // World position of the far end of the bat (the "business end")
  const local = new THREE.Vector3(0, 0, batLength);
  return local.applyMatrix4(batGroup.matrixWorld);
}

function checkSwingCollision() {
  const sweetSpot = getBatSweetSpotWorld();
  const d = sweetSpot.distanceTo(ballMesh.position);
  if (d < HIT_RADIUS && pitch.inFlight) {
    // -0.5 = swung early (bat still on its way out), 0 = perfectly on time, +0.5 = swung late.
    const timingOffset = (swing.t / swing.duration) - 0.5;
    // 0 = caught it off the end of the bat, 1 = dead-center barrel contact.
    const proximityQuality = 1 - (d / HIT_RADIUS);
    onBallHit(timingOffset, proximityQuality);
  }
}

// ---------- Runner: batter sprints the bases after putting the ball in play ----------
// `waypoints` is the queue of remaining bases (world positions) to run through;
// sendRunnerToBase() (below, once rosters/bases exist) fills it in per hit type.
const runner = {
  active: false,
  waypoints: [],
  speed: 0,
  attrs: null, // whichever batter this sprite currently represents
};
// ---------- Rosters (1 = worst, 10 = best): Speed, Throwing, Hitting ----------
const homeRoster = [
  { name: 'Cy Young',         pos: 'P',   speed: 7,  throwing: 9,  hitting: 5 },
  { name: 'Yogi Berra',       pos: 'C',   speed: 5,  throwing: 10, hitting: 8 },
  { name: 'Lou Gehrig',       pos: '1B',  speed: 7,  throwing: 8,  hitting: 9 },
  { name: 'Rogers Hornsby',   pos: '2B',  speed: 7,  throwing: 8,  hitting: 7 },
  { name: 'George Brett',     pos: '3B',  speed: 6,  throwing: 8,  hitting: 9 },
  { name: 'Honus Wagner',     pos: 'SS',  speed: 7,  throwing: 9,  hitting: 8 },
  { name: 'Rickey Henderson', pos: 'LF',  speed: 10, throwing: 6,  hitting: 6 },
  { name: 'Willie Mays',      pos: 'CF',  speed: 8,  throwing: 8,  hitting: 8 },
  { name: 'Babe Ruth',        pos: 'RF',  speed: 5,  throwing: 7,  hitting: 10 },
];
const visitorRoster = [
  { name: 'Greg Maddux',      pos: 'P',   speed: 6, throwing: 10, hitting: 6 },
  { name: 'Gary Carter',      pos: 'C',   speed: 7, throwing: 7,  hitting: 8 },
  { name: 'Pete Rose',        pos: '1B',  speed: 8, throwing: 6,  hitting: 10 },
  { name: 'Jackie Robinson',  pos: '2B',  speed: 8, throwing: 6,  hitting: 8 },
  { name: 'Mike Schmidt',     pos: '3B',  speed: 7, throwing: 7,  hitting: 7 },
  { name: 'Ozzie Smith',      pos: 'SS',  speed: 8, throwing: 8,  hitting: 6 },
  { name: 'Barry Bonds',      pos: 'LF',  speed: 8, throwing: 8,  hitting: 8 },
  { name: 'Dale Murphy',      pos: 'CF',  speed: 7, throwing: 7,  hitting: 8 },
  { name: 'Hank Aaron',       pos: 'RF',  speed: 7, throwing: 7,  hitting: 9 },
];

// Batting order: everyone bats in roster order, with the pitcher batting last.
function battingOrderFor(roster) {
  const order = [];
  roster.forEach((p, i) => { if (p.pos !== 'P') order.push(i); });
  order.push(roster.findIndex(p => p.pos === 'P'));
  return order;
}

const teams = {
  home:    { roster: homeRoster,    battingOrder: battingOrderFor(homeRoster),    lineupIndex: 0 },
  visitor: { roster: visitorRoster, battingOrder: battingOrderFor(visitorRoster), lineupIndex: 0 },
};

function battingTeam()  { return gameState.half === 'top' ? teams.visitor : teams.home; }
function fieldingTeam() { return gameState.half === 'top' ? teams.home : teams.visitor; }
function currentBatterAttrs()  { const t = battingTeam(); return t.roster[t.battingOrder[t.lineupIndex]]; }
function currentPitcherAttrs() { return fieldingTeam().roster.find(p => p.pos === 'P'); }
function advanceBatter() { const t = battingTeam(); t.lineupIndex = (t.lineupIndex + 1) % t.battingOrder.length; }

// Active pitcher/batter attributes — reassigned by refreshActivePlayers() whenever
// the batting order advances or the half-inning flips.
let pitcherAttributes;
let batterAttributes;

// ---------- Fielders: the 8 non-pitching defenders, placed at standard depth ----------
// Team colors are fixed to the team, not the batting/fielding role.
const HOME_COLOR = 0xffffff;
const VISITOR_COLOR = 0xff3b30;
const FIELDER_CATCH_RADIUS = 2.0;  // how close a fielder must be to catch a fly ball
const FIELDER_FIELD_RADIUS = 2.6;  // how close a fielder must be to field a grounder
const FIELDER_CATCH_HEIGHT = CAPSULE_TOTAL_HEIGHT * 1.6; // max reachable height for a catch
const OUTFIELD_POSITIONS = ['LF', 'CF', 'RF'];
const OUTFIELDER_REACTION_DELAY = 0.5; // seconds before an outfielder reads the ball and breaks for the landing spot

// Standing spots in feet from home plate (+Z toward center field, +X toward 3B/left field)
const FIELD_SPOTS_FT = {
  C:    { x: 0,   z: -6 },
  '1B': { x: -51, z: 60 },   // even with the bag, on the infield edge of first's dirt circle
  '2B': { x: -30, z: 110 },  // shaded toward first base
  SS:   { x: 30,  z: 110 },  // shaded toward third base
  '3B': { x: 54,  z: 66 },   // behind the bag, shaded a step toward second
  LF:   { x: 85,  z: 175 },
  CF:   { x: 0,   z: 195 },
  RF:   { x: -85, z: 175 },
};

const fielders = Object.keys(FIELD_SPOTS_FT).map((posKey) => {
  const spot = FIELD_SPOTS_FT[posKey];
  const homePos = new THREE.Vector3(spot.x * FT, standHeight, HOME.z + spot.z * FT);
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 8, 16),
    new THREE.MeshStandardMaterial({ color: HOME_COLOR, roughness: 0.55 })
  );
  mesh.position.copy(homePos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { posKey, mesh, homePos, attrs: null };
});

// Fielder speed rating -> chase speed (1 -> 11ft/s, 10 -> 22ft/s)
function fielderRatingToChaseSpeed(rating) {
  const ftPerSec = 11 + ((rating - 1) / 9) * (22 - 11);
  return ftPerSec * FT;
}

// Refreshes which players are active (pitcher on the mound, fielders, current
// batter) to match the current half-inning and batting order.
function refreshActivePlayers() {
  pitcherAttributes = currentPitcherAttrs(); 
  batterAttributes = currentBatterAttrs();
  nameCardPitcherEl.innerHTML = buildCardHTML(pitcherAttributes);
  nameCardBatterEl.innerHTML = buildCardHTML(batterAttributes);

  const fielding = fieldingTeam();
  const fieldColor = fielding === teams.home ? HOME_COLOR : VISITOR_COLOR;
  pitcherMesh.material.color.set(fieldColor);
  for (const f of fielders) {
    f.attrs = fielding.roster.find(p => p.pos === f.posKey);
    f.mesh.material.color.set(fieldColor);
  }

  const batting = battingTeam();
  batterMesh.material.color.set(batting === teams.home ? HOME_COLOR : VISITOR_COLOR);
}

// ---------- Base runners: persistent state for who's on base between pitches ----------
const BASE_ORDER = ['first', 'second', 'third'];
const BASE_WORLD_POS = { first: FIRST, second: SECOND, third: THIRD };

function makeRunnerMarker() {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(PLAYER_RADIUS, PLAYER_HEIGHT, 8, 16),
    new THREE.MeshStandardMaterial({ color: HOME_COLOR, roughness: 0.55 }) // recolored to the batting team in syncBaseRunnerMeshes()
  );
  mesh.visible = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
// Markers showing which bases are currently occupied, in the batting team's colors.
const baseRunnerMeshes = { first: makeRunnerMarker(), second: makeRunnerMarker(), third: makeRunnerMarker() };

// ---------- Base runner reads: lead off, advance, or tag up on a live ball ----------
// While a ball is in play, runners on base react like real baserunners: on a
// ball still in the air they stray partway toward the next base, ready to go
// either way; the instant it touches the ground (or the wall) they take off
// for the next base; and if a fly is caught they hustle back to their bag.
// The box-score result (how far everyone actually advances) is still decided
// at resolution — this drives the markers' movement in between.
const NEXT_BASE_POS = { first: SECOND, second: THIRD, third: HOME };
// t: 0 = standing on the bag, 1 = arrived at the next base.
// forcedAdvance: runners are completing a one-base advance (ground-ball out or
// infield single); drive t to 1 then commit `pending` occupancy — so they run
// all the way to the next base instead of teleporting there at the throw.
const runnerAnim = { t: 0, forcedAdvance: false, pending: null };
const RUNNER_LEAD_FRACTION = 0.3; // how far toward the next base they stray while the ball's in the air
const RUNNER_ANIM_RATE = 0.5;     // fraction of a basepath leg covered per second

function updateBaseRunnerAnim(dt) {
  if (inningTransition.phase !== 'none') return; // stranded runners are jogging off with the sides
  let target;
  if (runnerAnim.forcedAdvance) {
    target = 1; // finishing a deferred advance to the next base, then we commit occupancy
  } else if (throwToFirst.active || groundPlay.active || firstBasePutout.active) {
    // Infield grounder being fielded/thrown: the runners are committed and keep going
    // toward the next base (never retreating) until the out/safe call resolves it.
    target = 1;
  } else if (!inPlay.active) {
    target = 0; // between pitches: standing on the bag
  } else if (inPlay.resolved) {
    // The play's been called and occupancy is final (a hit was recorded, or a
    // fly was caught): hold on the assigned bag — don't drift to the next base.
    target = 0;
  } else if (inPlay.touchedGround || inPlay.touchedFence) {
    target = 1; // ball live and on the ground: runners advancing
  } else if (gameState.outs >= 2) {
    target = 1; // two outs: running on contact, even before the ball lands
  } else {
    target = RUNNER_LEAD_FRACTION; // ball in the air, fewer than two outs: edge off the bag
  }
  runnerAnim.t += clamp(target - runnerAnim.t, -RUNNER_ANIM_RATE * dt, RUNNER_ANIM_RATE * dt);
  // Position every visible marker each frame (even at t = 0, on the bag) so a
  // mid-play occupancy sync can never snap a leading runner around visibly.
  for (const key of BASE_ORDER) {
    const mesh = baseRunnerMeshes[key];
    if (!mesh.visible) continue;
    const from = BASE_WORLD_POS[key];
    const to = NEXT_BASE_POS[key];
    mesh.position.set(
      from.x + (to.x - from.x) * runnerAnim.t,
      standHeight,
      from.z + (to.z - from.z) * runnerAnim.t
    );
  }
  // The runners have reached the next base — now commit the deferred occupancy,
  // seamlessly (their markers are already sitting on the new bags at t = 1).
  if (runnerAnim.forcedAdvance && runnerAnim.t >= 1) commitForcedAdvance();
}

// Existing base runners each advance one base (a runner from third scores);
// `batterToFirst` also lands the batter on first (an infield single). Returns
// the resulting occupancy without applying it.
function runnersAdvancedOneBase(batterToFirst) {
  const newBases = { first: null, second: null, third: null };
  BASE_ORDER.forEach((baseKey, i) => {
    const occupant = gameState.bases[baseKey];
    if (occupant) placeAtBaseIndex(newBases, (i + 1) + 1, occupant); // one base ahead; third scores
  });
  if (batterToFirst) newBases.first = runner.attrs; // the batter, captured at contact
  return newBases;
}

function anyRunnersOn() {
  return !!(gameState.bases.first || gameState.bases.second || gameState.bases.third);
}

// Advance runners a base, animated. If runners are on, defer the occupancy change
// until their markers finish running to the next base; otherwise apply at once.
function beginRunnerAdvance(batterToFirst) {
  const finalBases = runnersAdvancedOneBase(batterToFirst);
  if (anyRunnersOn()) {
    runnerAnim.pending = finalBases;
    runnerAnim.forcedAdvance = true;
  } else {
    gameState.bases = finalBases;
    runnerAnim.t = 0;
    syncBaseRunnerMeshes();
  }
}

function commitForcedAdvance() {
  gameState.bases = runnerAnim.pending;
  runnerAnim.pending = null;
  runnerAnim.forcedAdvance = false;
  runnerAnim.t = 0;
  syncBaseRunnerMeshes();
  updateScoreBug(); // a runner from third may have scored on the advance
}

function syncBaseRunnerMeshes() {
  // Runners belong to whichever team is batting — wear their color.
  const runnerColor = battingTeam() === teams.home ? HOME_COLOR : VISITOR_COLOR;
  for (const key of BASE_ORDER) {
    const occupant = gameState.bases[key];
    // While the batter's own sprite is still sprinting toward this base, let
    // that sprite alone represent them — don't show a marker there in advance.
    const stillEnRoute = runner.active && occupant === runner.attrs;
    const occupied = !!occupant && !stillEnRoute;
    baseRunnerMeshes[key].visible = occupied;
    if (occupied) {
      const pos = BASE_WORLD_POS[key];
      baseRunnerMeshes[key].position.set(pos.x, standHeight, pos.z);
      baseRunnerMeshes[key].material.color.set(runnerColor);
    }
  }
}

// Places a runner `index` bases past home (1=first, 2=second, 3=third, 4+=scores).
function placeAtBaseIndex(newBases, index, runnerAttrs) {
  if (index >= 4) {
    gameState[battingTeamScoreKey()]++;
    return;
  }
  newBases[BASE_ORDER[index - 1]] = runnerAttrs;
}

// A batted-ball hit advances every existing runner the same number of bases as
// the batter; anyone pushed past third scores.
function advanceRunnersForHit(bases, batterAttrs) {
  const newBases = { first: null, second: null, third: null };
  BASE_ORDER.forEach((baseKey, i) => {
    const occupant = gameState.bases[baseKey];
    if (occupant) placeAtBaseIndex(newBases, (i + 1) + bases, occupant);
  });
  placeAtBaseIndex(newBases, bases, batterAttrs);
  gameState.bases = newBases;
  runnerAnim.t = 0; // occupancy changed: markers restart from their new bags
  syncBaseRunnerMeshes();
}

// On a ground-ball out at first, the other runners were already running when
// the ball was on the ground — they keep the next base instead of returning,
// finishing the run there (not teleporting). Rulebook exception: if the out at
// first is the third out, the inning is over and nobody advances or scores.
function advanceRunnersOnGroundOut() {
  if (gameState.outs >= 2) return; // this out ends the inning
  if (anyRunnersOn()) beginRunnerAdvance(false);
}

// ---------- Inning transition: the sides hustle off and on between half-innings ----------
// On the third out the retiring defense jogs to its own baseline (home team to
// the first-base line, visitors to the third-base line), stranded runners jog to
// their side's baseline, everyone disappears at the line, and the new defense
// runs on from its baseline to take the field.
const inningTransition = { phase: 'none', off: [], on: [] }; // phase: 'none' | 'off' | 'on'
const TRANSITION_SPEED = fielderRatingToChaseSpeed(10) * 1.75; // hustle so the game isn't delayed
const ON_FIELD_DELAY = 1.5; // seconds before the first of the new defense steps onto the field
const PITCHER_HOME = pitcherMesh.position.clone();
const BASELINE_DIRS = {
  first: new THREE.Vector3().subVectors(FIRST, HOME).normalize(),
  third: new THREE.Vector3().subVectors(THIRD, HOME).normalize(),
};

// Nearest point on the given foul line ("first" or "third") to `pos`, kept a
// sensible stretch out from home so players spread out along the baseline.
function baselinePoint(pos, side) {
  const dir = BASELINE_DIRS[side];
  const t = clamp((pos.x - HOME.x) * dir.x + (pos.z - HOME.z) * dir.z, 30 * FT, 160 * FT);
  return new THREE.Vector3(HOME.x + dir.x * t, pos.y, HOME.z + dir.z * t);
}

function teamBaselineSide(team) { return team === teams.home ? 'first' : 'third'; }

function startInningTransition() {
  const offSide = teamBaselineSide(fieldingTeam());
  const strandedSide = teamBaselineSide(battingTeam());

  // The retiring defense jogs off as throwaway "ghost" copies, freeing the real
  // fielder meshes to be restaffed for the new defense immediately — both teams
  // are on the move at the same time.
  inningTransition.off = [];
  for (const mesh of [...fielders.map(f => f.mesh), pitcherMesh]) {
    const ghost = mesh.clone();
    ghost.material = mesh.material.clone(); // recoloring the real mesh must not recolor the ghost
    scene.add(ghost);
    inningTransition.off.push({ mesh: ghost, target: baselinePoint(mesh.position, offSide), isGhost: true });
  }
  // Stranded runners jog to their own side's baseline (their real markers — the
  // bases are empty next half, so these are free to leave and hide on arrival).
  for (const key of BASE_ORDER) {
    const marker = baseRunnerMeshes[key];
    if (marker.visible) inningTransition.off.push({ mesh: marker, target: baselinePoint(marker.position, strandedSide) });
  }
  gameState.bases = { first: null, second: null, third: null };
  runnerAnim.t = 0;

  // The ball leaves with the old defense: hide it and cancel any in-flight
  // return throw — it reappears in the new pitcher's hand once everyone's set.
  ballMesh.visible = false;
  ballReturn.active = false;
  ballReturn.waypoints = [];
  ballReturn.relayFielder = null;
  ballReturn.thrower = null;
  throwToFirst.active = false;
  groundPlay.active = false;
  groundPlay.pauseLeft = 0;
  firstBasePutout.active = false;
  firstBasemanCharging = false;
  pitcherCoveringFirst = false;
  pitcherReturning = false;

  if (gameState.half === 'top') {
    gameState.half = 'bottom';
  } else {
    gameState.half = 'top';
    gameState.inning++;
  }

  // New defense takes the field from its own baseline — after a beat, and in a
  // staggered trickle rather than all nine stepping on at the same instant.
  refreshActivePlayers();
  const onSide = teamBaselineSide(fieldingTeam());
  inningTransition.on = [...fielders.map(f => ({ mesh: f.mesh, home: f.homePos })), { mesh: pitcherMesh, home: PITCHER_HOME }]
    .map((p, i) => {
      p.mesh.position.copy(baselinePoint(p.home, onSide));
      p.mesh.visible = false; // hidden until their own start delay expires
      return {
        mesh: p.mesh,
        target: p.home.clone(),
        delay: ON_FIELD_DELAY + i * randIn(0.2, 0.45), // trickle on one after another
      };
    });
  inningTransition.phase = 'active';
}

function updateInningTransition(dt) {
  if (inningTransition.phase !== 'active') return;
  const step = (list, onArrive) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i];
      if (item.delay > 0) { // not their turn to step onto the field yet
        item.delay -= dt;
        if (item.delay > 0) continue;
        item.mesh.visible = true;
      }
      const toTarget = new THREE.Vector3().subVectors(item.target, item.mesh.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist <= 0.3) {
        onArrive(item);
        list.splice(i, 1);
        continue;
      }
      toTarget.normalize();
      item.mesh.position.addScaledVector(toTarget, Math.min(TRANSITION_SPEED * dt, dist));
    }
  };
  // Each departing player disappears the moment they personally reach the line.
  step(inningTransition.off, (item) => {
    item.mesh.visible = false;
    if (item.isGhost) {
      scene.remove(item.mesh);
      item.mesh.material.dispose();
    }
  });
  step(inningTransition.on, () => {});
  if (inningTransition.off.length === 0 && inningTransition.on.length === 0) {
    inningTransition.phase = 'none';
    ballMesh.visible = true; // ball reappears in the new pitcher's hand
    resetPitchToPitcher();
  }
}

// A walk only forces runners who have no open base behind them.
function advanceRunnersForWalk(batterAttrs) {
  if (gameState.bases.first) {
    if (gameState.bases.second) {
      if (gameState.bases.third) {
        gameState[battingTeamScoreKey()]++;
      }
      gameState.bases.third = gameState.bases.second;
    }
    gameState.bases.second = gameState.bases.first;
  }
  gameState.bases.first = batterAttrs;
  runnerAnim.t = 0; // occupancy changed: markers restart from their new bags
  syncBaseRunnerMeshes();
}

// Sends the batter's own runner mesh sprinting through `bases` bases in
// sequence (1 = first only, up through 4 = around to home on a home run).
function sendRunnerToBase(bases) {
  runner.waypoints = [FIRST, SECOND, THIRD, HOME].slice(0, bases)
    .map(b => new THREE.Vector3(b.x, batterMesh.position.y, b.z));
  runner.speed = speedRatingToRunnerSpeed(batterAttributes.speed, HOME.distanceTo(FIRST));
  runner.attrs = batterAttributes; // capture identity now — batterAttributes reassigns once the at-bat ends
  runner.active = true;
}

// Speed rating -> time to reach first base (1 -> 4s, 10 -> 2s)
function speedRatingToTimeToFirst(rating) {
  return 4 - ((rating - 1) / 9) * (4 - 2); // linear interpolation
}
function speedRatingToRunnerSpeed(rating, distance) {
  return distance / speedRatingToTimeToFirst(rating);
}
function updateRunner(dt) {
  if (!runner.active || runner.waypoints.length === 0) return;
  const target = runner.waypoints[0];
  const dir = new THREE.Vector3().subVectors(target, batterMesh.position);
  const dist = dir.length();
  if (dist < 0.15) {
    batterMesh.position.copy(target);
    runner.waypoints.shift();
    if (runner.waypoints.length === 0) {
      runner.active = false;
      syncBaseRunnerMeshes(); // reveal this runner's marker now that their sprite has arrived
    }
    return;
  }
  dir.normalize();
  batterMesh.position.addScaledVector(dir, Math.min(runner.speed * dt, dist));
}

// ---------- Hitting engine: outcome-first, tuned to real baseball rates ----------
// A ball put in play becomes a hit about 3 times in 10. Singles are by far the
// most common hit, then doubles and home runs, with triples rare. The engine
// rolls WHAT the play becomes first (nudged by the batter/pitcher matchup and
// how clean the swing contact was), then synthesizes a batted ball to match:
// weak and hard grounders at or through the infield, pop-ups over the infield,
// shallow and deep flies to the outfield, liners, gap shots, corner shots, and
// drives over the fence. The defense still animates the play, but the called
// result stands — like a real box score.

const INFIELD_KEYS = ['1B', '2B', 'SS', '3B'];
const SPRAY_LIMIT = Math.PI / 4 - 0.08; // keep batted balls inside the foul lines (±45°)

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function randIn(lo, hi) { return lo + Math.random() * (hi - lo); }
function pickWeighted(entries) { // entries: [[value, weight], ...]
  const total = entries.reduce((sum, e) => sum + Math.max(0, e[1]), 0);
  let r = Math.random() * total;
  for (const [value, weight] of entries) {
    r -= Math.max(0, weight);
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// Horizontal spray angle (radians off dead center field; the foul lines are ±45°)
function sprayToDir(spray) { return new THREE.Vector3(Math.sin(spray), 0, Math.cos(spray)); }
function sprayToward(point) { return clamp(Math.atan2(point.x - HOME.x, point.z - HOME.z), -SPRAY_LIMIT, SPRAY_LIMIT); }
function fielderByPos(posKey) { return fielders.find(f => f.posKey === posKey); }
function randomFielderFrom(keys) { return fielderByPos(keys[Math.floor(Math.random() * keys.length)]); }
function distToHome(point) { return Math.hypot(point.x - HOME.x, point.z - HOME.z); }

// Distance from home plate to the outfield fence along a spray direction.
function fenceDistanceAlongDir(dir) {
  const far = new THREE.Vector3().copy(HOME).addScaledVector(dir, FIELD_SIZE * 2);
  let best = null;
  for (const seg of fenceSegments) {
    const hit = segmentIntersect2D(HOME, far, seg.start, seg.end);
    if (!hit) continue;
    const d = distToHome(hit.point);
    if (best === null || d < best) best = d;
  }
  return best ?? 220 * FT;
}

// Exit speed that carries a ball `dist` world units at `angleRad` (flat ground, no drag).
function speedForCarry(dist, angleRad) {
  return Math.sqrt(Math.max(dist, 1) * -GRAVITY / Math.max(Math.sin(2 * angleRad), 0.05));
}

// Finds a landing spot between `minDistFt` and `maxDistFt` from home that's as far
// from every defender as possible — where bloops and soft liners "find grass".
function pickLandingAwayFromFielders(minDistFt, maxDistFt) {
  let best = null;
  for (let i = 0; i < 16; i++) {
    const spray = randIn(-SPRAY_LIMIT, SPRAY_LIMIT);
    const dist = randIn(minDistFt, maxDistFt) * FT;
    const p = new THREE.Vector3().copy(HOME).addScaledVector(sprayToDir(spray), dist);
    const gap = Math.min(...fielders.map(f => Math.hypot(p.x - f.homePos.x, p.z - f.homePos.z)));
    if (!best || gap > best.gap) best = { spray, dist, gap };
  }
  return best;
}

// Rolls what the play becomes. `quality` is 0..1 swing contact quality.
function rollPlayOutcome(quality) {
  const matchup = (batterAttributes.hitting - pitcherAttributes.throwing) / 9; // -1..1
  const hitChance = clamp(0.30 + matchup * 0.08 + (quality - 0.5) * 0.18, 0.12, 0.55);

  if (Math.random() >= hitChance) {
    // An out. Weak contact tends to stay on the ground or go straight up;
    // good contact that still gets caught tends to be a liner or a deep fly.
    return pickWeighted([
      ['ground_out',      42 - quality * 10],
      ['popup_infield',   14 - quality * 6],
      ['fly_out_shallow', 20],
      ['fly_out_deep',    12 + quality * 14],
      ['line_out',        8 + quality * 6],
    ]);
  }

  // A hit. Power hitters and flush contact tilt doubles/homers up; fast
  // runners leg out the occasional triple.
  const power = (batterAttributes.hitting - 5.5) / 4.5 + (quality - 0.5); // ~ -1.5..1.5
  return pickWeighted([
    ['single', 65],
    ['double', 20 * (1 + 0.35 * power)],
    ['triple', 1.5 + batterAttributes.speed * 0.25],
    ['homer',  11 * (1 + 0.75 * power)],
  ]);
}

const PLAY_TYPE_BASES = { single: 1, double: 2, triple: 3, homer: 4 }; // everything else is an out

// Builds the batted ball for a play type: spray angle, launch angle, exit speed.
function buildBattedBall(playType) {
  const jitter = () => randIn(-0.05, 0.05);
  const deg = Math.PI / 180;
  switch (playType) {
    case 'ground_out': { // firm grounder right at an infielder
      const f = randomFielderFrom(INFIELD_KEYS);
      // Firm enough to actually reach the fielder's spot — a slower roller dies
      // in the middle of the infield by the mound, reading as a comebacker.
      return { spray: sprayToward(f.homePos) + jitter(), angleDeg: randIn(-4, 6), speed: randIn(21, 30) };
    }
    case 'popup_infield': { // sky-high pop that comes down on the infield
      const f = randomFielderFrom(INFIELD_KEYS);
      const angleDeg = randIn(62, 76);
      const dist = distToHome(f.homePos) * randIn(0.8, 1.0);
      return { spray: sprayToward(f.homePos) + jitter(), angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'fly_out_shallow': { // can of corn in front of an outfielder
      const f = randomFielderFrom(OUTFIELD_POSITIONS);
      const angleDeg = randIn(38, 52);
      const dist = distToHome(f.homePos) * randIn(0.75, 1.0);
      return { spray: sprayToward(f.homePos) + jitter(), angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'fly_out_deep': { // driven toward the track, run down by the outfielder
      const f = randomFielderFrom(OUTFIELD_POSITIONS);
      const spray = sprayToward(f.homePos) + jitter() * 2;
      const angleDeg = randIn(34, 44);
      const dist = fenceDistanceAlongDir(sprayToDir(spray)) * randIn(0.78, 0.92);
      return { spray, angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'line_out': { // rope hit right at a defender
      const f = randomFielderFrom([...INFIELD_KEYS, ...OUTFIELD_POSITIONS]);
      const angleDeg = randIn(10, 18);
      const dist = distToHome(f.homePos) * randIn(0.96, 1.04);
      return { spray: sprayToward(f.homePos) + jitter() * 0.5, angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'single': {
      if (Math.random() < 0.6) {
        // Hard grounder through a hole in the infield, out to an outfielder.
        // Holes sit between the infielders (their spots are at roughly ±0.27
        // and ±0.72 radians of spray). Straight back at the mound is rare in
        // real baseball, so the up-the-middle lane is weighted way down and
        // nudged off dead center so it skirts the pitcher instead of hitting him.
        const hole = pickWeighted([[-0.48, 1], [0.48, 1], [0, 0.1], [-0.66, 0.6], [0.66, 0.6]]);
        const offCenter = hole === 0 ? (Math.random() < 0.5 ? -1 : 1) * randIn(0.1, 0.16) : 0;
        return { spray: clamp(hole + offCenter + jitter(), -SPRAY_LIMIT, SPRAY_LIMIT), angleDeg: randIn(0, 7), speed: randIn(30, 40) };
      }
      // Soft liner / bloop that drops between the infield and the outfield.
      const spot = pickLandingAwayFromFielders(110, 150);
      const angleDeg = randIn(22, 34);
      return { spray: spot.spray, angleDeg, speed: speedForCarry(spot.dist, angleDeg * deg) };
    }
    case 'double': { // liner into one of the outfield gaps, rolling to the wall
      const spray = clamp((Math.random() < 0.5 ? -0.24 : 0.24) + jitter() * 2, -SPRAY_LIMIT, SPRAY_LIMIT);
      const angleDeg = randIn(16, 24);
      const dist = fenceDistanceAlongDir(sprayToDir(spray)) * randIn(0.88, 1.0);
      return { spray, angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'triple': { // shot down one of the lines, into a corner
      const spray = (Math.random() < 0.5 ? -1 : 1) * randIn(0.56, SPRAY_LIMIT);
      const angleDeg = randIn(13, 20);
      const dist = fenceDistanceAlongDir(sprayToDir(spray)) * randIn(0.85, 0.98);
      return { spray, angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
    case 'homer': { // no-doubter over the fence
      const spray = randIn(-0.55, 0.55);
      const angleDeg = randIn(26, 35);
      const dist = fenceDistanceAlongDir(sprayToDir(spray)) * randIn(1.2, 1.45);
      return { spray, angleDeg, speed: speedForCarry(dist, angleDeg * deg) };
    }
  }
}

// timingOffset: -0.5 (early) .. 0 (perfect) .. +0.5 (late). proximityQuality: 0 (off
// the end of the bat) .. 1 (flush barrel contact). Together they set the swing's
// contact quality, which nudges the outcome roll — but the roll, not physics
// randomness, decides the play.
function onBallHit(timingOffset, proximityQuality) {
  pitch.inFlight = false;

  const quality = clamp(proximityQuality - Math.abs(timingOffset) * 0.6, 0, 1);
  const playType = rollPlayOutcome(quality);
  const { spray, angleDeg, speed } = buildBattedBall(playType);
  const launchAngle = angleDeg * (Math.PI / 180);
  const launchDir = sprayToDir(spray);

  // Batter drops the bat and runs hard out of the box. The outcome is already
  // rolled, so on an extra-base hit he heads straight for second/third (or all
  // the way around on a homer) while the ball is still rolling, instead of
  // waiting at first for the fielder to pick it up. On a called out he still
  // runs out the grounder to first.
  batGroup.visible = false;
  const calledBases = PLAY_TYPE_BASES[playType] ?? 0;
  sendRunnerToBase(Math.max(1, calledBases));

  inPlay.active = true;
  inPlay.resting = false;
  inPlay.touchedGround = false;
  inPlay.touchedFence = false;
  inPlay.homerunCalled = false;
  inPlay.resolved = false;
  inPlay.calledBases = calledBases;
  hitClock = 0;
  inPlay.velocity.set(
    launchDir.x * speed * Math.cos(launchAngle),
    speed * Math.sin(launchAngle),
    launchDir.z * speed * Math.cos(launchAngle)
  );
  ballMesh.position.copy(getBatSweetSpotWorld());
  ballMesh.position.y = Math.max(ballMesh.position.y, BALL_RADIUS);
  inPlay.prevPos.copy(ballMesh.position);
}

// ---------- Score bug (always visible, top-right): score, inning, outs, count ----------
const gameState = {
  visitorScore: 0,
  homeScore: 0,
  inning: 1,
  half: 'top', // 'top' = visitor batting, 'bottom' = home batting
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: { first: null, second: null, third: null }, // occupant = that runner's roster attrs, or null
};

function battingTeamScoreKey() {
  return gameState.half === 'top' ? 'visitorScore' : 'homeScore';
}

function updateScoreBug() {
  const halfSymbol = gameState.half === 'top' ? '▲' : '▼';
  document.getElementById('scoreBug').innerHTML =
    `<div class="score-bug-row"><span class="score-bug-team">Visitor</span><span>${gameState.visitorScore}</span></div>` +
    `<div class="score-bug-row"><span class="score-bug-team">Home</span><span>${gameState.homeScore}</span></div>` +
    `<div class="score-bug-divider"></div>` +
    `<div class="score-bug-row"><span>${halfSymbol} Inning ${gameState.inning}</span><span>${gameState.outs} Out${gameState.outs === 1 ? '' : 's'}</span></div>` +
    `<div class="score-bug-row"><span>Count</span><span>${gameState.balls}-${gameState.strikes}</span></div>`;
}
updateScoreBug();

// Ends the current at-bat: resets the ball/strike count and refreshes the
// active pitcher/batter/fielders for whoever is up next.
function endAtBat() {
  gameState.balls = 0;
  gameState.strikes = 0;
  refreshActivePlayers();
  updateScoreBug();
}

// Ends the current batter's plate appearance as an out (strikeout, caught fly,
// or a grounder fielded in time to beat the runner to first).
function recordOut() {
  advanceBatter();
  gameState.outs++;
  if (gameState.outs >= 3) {
    // Side retired: the transition flips the half-inning, jogs the old defense
    // (and stranded runners) off, and refreshes the players at the swap — so
    // here just reset the count and scoreboard.
    gameState.outs = 0;
    startInningTransition();
    gameState.balls = 0;
    gameState.strikes = 0;
    updateScoreBug();
    return;
  }
  endAtBat();
}

// Batter draws a walk: only forces runners who have no open base behind them.
function recordWalk() {
  advanceRunnersForWalk(batterAttributes);
  advanceBatter();
  endAtBat();
}

// Batter reaches base on a batted ball the defense couldn't retire in time;
// every existing runner advances the same number of bases as the batter.
function recordHit(bases) {
  advanceRunnersForHit(bases, batterAttributes);
  advanceBatter();
  endAtBat();
}

function recordHomeRun() {
  advanceRunnersForHit(4, batterAttributes);
  advanceBatter();
  endAtBat();
}

// ---------- Player name cards (shown briefly above each player at the start of a play) ----------
const nameCardPitcherEl = document.getElementById('nameCardPitcher');
const nameCardBatterEl = document.getElementById('nameCardBatter');

function buildCardHTML(attrs) {
  return `<div class="name-card-title">${attrs.name}</div>` +
    `Throwing: ${attrs.throwing} &nbsp; Speed: ${attrs.speed} &nbsp; Hitting: ${attrs.hitting}`;
}
refreshActivePlayers();

const nameCards = { visible: false, hideTimer: null };

function showNameCards() {
  nameCards.visible = true;
  nameCardPitcherEl.style.opacity = '1';
  nameCardBatterEl.style.opacity = '1';
  clearTimeout(nameCards.hideTimer);
  nameCards.hideTimer = setTimeout(() => {
    nameCardPitcherEl.style.opacity = '0';
    nameCardBatterEl.style.opacity = '0';
    nameCards.visible = false;
  }, 2000);
}

function positionCardAbove(el, worldPos, heightAbove) {
  const p = new THREE.Vector3(worldPos.x, worldPos.y + heightAbove, worldPos.z);
  p.project(camera);
  const x = (p.x * 0.5 + 0.5) * innerWidth;
  const y = (-p.y * 0.5 + 0.5) * innerHeight;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

function updateNameCards() {
  if (!nameCards.visible) return;
  positionCardAbove(nameCardPitcherEl, pitcherMesh.position, CAPSULE_TOTAL_HEIGHT * 0.7);
  positionCardAbove(nameCardBatterEl, batterMesh.position, CAPSULE_TOTAL_HEIGHT * 0.7);
}

function resetPitchToPitcher() {
  if (runnerAnim.forcedAdvance) commitForcedAdvance(); // safety: settle any in-progress advance
  firstBasemanCharging = false; // fresh pitch: the first baseman starts back at his position
  pitcherCoveringFirst = false;
  pitcherReturning = false;
  pitcherMesh.position.copy(PITCHER_HOME); // snap the pitcher back to the mound if he'd gone to cover
  ballMesh.position.set(
    pitcherMesh.position.x + PLAYER_RADIUS * 0.8,
    ballHoldHeight,
    pitcherMesh.position.z - PLAYER_RADIUS * 0.3
  );
  inPlay.active = false;
  inPlay.resting = false;
  inPlay.homerunCalled = false; // release the camera's home-run-follow lock
  pitch.inFlight = false;
  pitch.resetting = false;

  // Batter returns to the box and picks the bat back up
  runner.active = false;
  batterMesh.position.copy(batterPos);
  batGroup.position.set(batterPos.x, (2 / 3) * CAPSULE_TOTAL_HEIGHT, batterPos.z);
  batGroup.visible = true;
}

// ---------- Ball-in-play physics (after a hit): gravity, bounce, friction, rest ----------
const inPlay = {
  active: false,
  resting: false,
  velocity: new THREE.Vector3(),
  prevPos: new THREE.Vector3(),
  touchedGround: false,
  touchedFence: false, // once the ball's hit the fence, it can no longer be caught for an out
  homerunCalled: false,
  resolved: false, // true once a home run is called or a fielder has caught/fielded the ball
  calledBases: 0, // the play's pre-rolled result: 0 = out, 1-3 = single/double/triple, 4 = homer
};
const GRAVITY = -32 * FT; // world units/s^2
const RESTING_SPEED = 0.5; // below this speed (units/s) we consider the ball "at rest"
let hitClock = 0; // seconds elapsed since the ball was put in play, used to time defensive plays

// Predicts where an airborne ball will hit the ground, given its current
// position/velocity and constant gravity — lets fielders break toward the
// landing spot instead of just chasing wherever the ball currently is.
function predictLandingSpot() {
  const pos = ballMesh.position;
  const vel = inPlay.velocity;
  const a = 0.5 * GRAVITY;
  const b = vel.y;
  const c = pos.y - BALL_RADIUS;
  const disc = b * b - 4 * a * c;
  let t = 0.5;
  if (disc >= 0 && Math.abs(a) > 1e-6) {
    const sqrtDisc = Math.sqrt(disc);
    t = Math.max((-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a));
    if (t < 0) t = 0.1;
  }
  return new THREE.Vector3(pos.x + vel.x * t, pos.y, pos.z + vel.z * t);
}

function segmentIntersect2D(p1, p2, p3, p4) {
  // Returns {t, point} where the segment p1->p2 crosses segment p3->p4, or null.
  const d1x = p2.x - p1.x, d1z = p2.z - p1.z;
  const d2x = p4.x - p3.x, d2z = p4.z - p3.z;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p3.x - p1.x) * d2z - (p3.z - p1.z) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1z - (p3.z - p1.z) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, point: new THREE.Vector3(p1.x + d1x * t, 0, p1.z + d1z * t) };
}

function showPitchCall(message) {
  const el = document.getElementById('pitchCallText');
  el.textContent = message;
  el.classList.remove('show');
  void el.offsetWidth; // restart animation
  el.classList.add('show');
}

// Resets for the next pitch no sooner than `minDelayMs`, and not until the
// runner's sprite has actually finished rounding the bases (whichever is later).
function scheduleResetAfterPlay(minDelayMs) {
  const startedAt = Date.now();
  (function poll() {
    if (!runner.active && !ballReturn.active && !throwToFirst.active && !groundPlay.active && !firstBasePutout.active && !pitcherReturning && !runnerAnim.forcedAdvance && Date.now() - startedAt >= minDelayMs) {
      resetPitchToPitcher();
    } else {
      setTimeout(poll, 200);
    }
  })();
}

function checkHomeRun() {
  if (inPlay.homerunCalled || inPlay.touchedGround) return;
  const prev = inPlay.prevPos;
  const curr = ballMesh.position;
  for (const seg of fenceSegments) {
    const hit = segmentIntersect2D(prev, curr, seg.start, seg.end);
    if (!hit) continue;
    const heightAtCross = prev.y + (curr.y - prev.y) * hit.t;
    if (heightAtCross > seg.height + BALL_RADIUS) {
      // Ball cleared the fence in the air, without ever touching the ground — home run!
      inPlay.homerunCalled = true;
      inPlay.resolved = true;
      // A called homer's batter has been rounding the bases since contact;
      // re-sending would restart his waypoints and make him double back.
      if (inPlay.calledBases !== 4) sendRunnerToBase(4);
      recordHomeRun();
      triggerHomeRun();
      scheduleResetAfterPlay(3000);
      return;
    }
  }
}

function triggerHomeRun() {
  const overlay = document.getElementById('homerunOverlay');
  const text = document.getElementById('homerunText');
  const confettiLayer = document.getElementById('confettiLayer');

  overlay.style.display = 'block';
  text.classList.remove('playing');
  // restart the CSS animation
  void text.offsetWidth;
  text.classList.add('playing');

  // Spawn a burst of confetti pieces
  confettiLayer.innerHTML = '';
  const colors = ['#ffd700', '#ff4136', '#2f7df6', '#ffffff', '#2ecc40', '#ff851b'];
  const pieceCount = 120;
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    const duration = 2 + Math.random() * 1.5;
    const delay = Math.random() * 0.6;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;
    confettiLayer.appendChild(piece);
  }

  setTimeout(() => {
    overlay.style.display = 'none';
    confettiLayer.innerHTML = '';
    text.classList.remove('playing');
  }, 3000);
}

function checkFenceCollision() {
  if (inPlay.homerunCalled) return; // ball cleared the fence in the air — no bounce, let it sail
  const prev = inPlay.prevPos;
  const curr = ballMesh.position;
  // Quick reject: if both ends of this frame's travel are well above every fence, skip
  const maxFenceHeight = 8 * FT;
  if (prev.y > maxFenceHeight + BALL_RADIUS && curr.y > maxFenceHeight + BALL_RADIUS) return;

  let closestHit = null;
  for (const seg of fenceSegments) {
    const hit = segmentIntersect2D(prev, curr, seg.start, seg.end);
    if (!hit) continue;
    // Height of the ball at the moment it crosses the fence's XZ line (linear interpolation)
    const heightAtCross = prev.y + (curr.y - prev.y) * hit.t;
    if (heightAtCross > seg.height + BALL_RADIUS) continue; // flew over the top
    if (!closestHit || hit.t < closestHit.t) {
      closestHit = { ...hit, seg, heightAtCross };
    }
  }

  if (closestHit) {
    inPlay.touchedFence = true; // once it's hit the fence, it can no longer be caught for an out
    const seg = closestHit.seg;
    const segDir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
    // Outward normal: perpendicular to the fence, pointing back toward where the ball came from
    let normal = new THREE.Vector3(-segDir.z, 0, segDir.x);
    const fromStart = new THREE.Vector3().subVectors(prev, seg.start);
    if (fromStart.dot(normal) < 0) normal.negate();

    const collideDist = seg.thickness / 2 + BALL_RADIUS;
    ballMesh.position.set(
      closestHit.point.x + normal.x * collideDist,
      closestHit.heightAtCross,
      closestHit.point.z + normal.z * collideDist
    );

    const vHoriz = new THREE.Vector3(inPlay.velocity.x, 0, inPlay.velocity.z);
    const vDotN = vHoriz.dot(normal);
    const reflected = new THREE.Vector3().copy(vHoriz).addScaledVector(normal, -2 * vDotN);
    inPlay.velocity.x = reflected.x * 0.6; // energy loss on the bounce
    inPlay.velocity.z = reflected.z * 0.6;
    inPlay.velocity.y *= 0.8;
  }
}

// ---------- Ball return: after a catch, throw the ball back in (relayed ----------
// ---------- through the infield for outfielders) and back to the pitcher. ----------
const ballReturn = {
  active: false,
  waypoints: [],
  speed: 0,
  pause: 0, // seconds the ball waits in the cutoff man's glove before the relay throw
  relayFielder: null, // cutoff man to hold in place until he's relayed the ball on
  thrower: null, // the fielder holding the ball through an initial pause — stays put until his throw is away
  onDone: null, // optional callback fired once the ball reaches the pitcher
};
const RELAY_PAUSE = 0.5; // beat between the cutoff man catching it and throwing to the pitcher

// The catcher throws a called ball/strike back to the pitcher (the ball is
// sitting where the pitch ended up, near the plate). Clears pitch.resetting
// when it lands, freeing the next pitch.
function startCatcherReturn() {
  if (inningTransition.phase !== 'none') { pitch.resetting = false; return; }
  ballReturn.waypoints = [pitcherHandPos()];
  ballReturn.speed = throwingRatingToThrowSpeed(fielderByPos('C').attrs.throwing);
  ballReturn.pause = 0;
  ballReturn.relayFielder = null;
  ballReturn.thrower = null;
  ballReturn.onDone = () => { pitch.resetting = false; };
  ballReturn.active = true;
}

function pitcherHandPos() {
  return new THREE.Vector3(
    pitcherMesh.position.x + PLAYER_RADIUS * 0.8,
    ballHoldHeight,
    pitcherMesh.position.z - PLAYER_RADIUS * 0.3
  );
}

function startBallReturn(fielder, initialPause = 0) {
  if (inningTransition.phase !== 'none') return; // side retired: the ball leaves with the teams
  const waypoints = [];
  let relayFielder = null;
  if (OUTFIELD_POSITIONS.includes(fielder.posKey)) {
    // Outfield catch: hit the cutoff man first, who relays it back to the pitcher.
    relayFielder = fielderByPos(relayAlignment(fielder.mesh.position).cutoffKey);
    waypoints.push(new THREE.Vector3(relayFielder.mesh.position.x, ballHoldHeight, relayFielder.mesh.position.z));
  }
  waypoints.push(pitcherHandPos()); // infield catch: toss it straight back to the pitcher
  ballReturn.waypoints = waypoints;
  ballReturn.speed = throwingRatingToThrowSpeed(fielder.attrs.throwing);
  ballReturn.pause = initialPause; // beat the fielder holds it before the throw back in
  ballReturn.relayFielder = relayFielder; // held in place until the relay is away
  ballReturn.thrower = initialPause > 0 ? fielder : null; // holds his spot while holding the ball
  ballReturn.onDone = null;
  ballReturn.active = true;
}

function basesEmpty() {
  return !gameState.bases.first && !gameState.bases.second && !gameState.bases.third;
}

function updateBallReturn(dt) {
  if (!ballReturn.active || ballReturn.waypoints.length === 0) return;
  // Whoever has the ball holds it (and his spot) a beat before throwing on.
  if (ballReturn.pause > 0) {
    ballReturn.pause -= dt;
    if (ballReturn.pause <= 0) ballReturn.thrower = null; // throw is away — he can jog home now
    return;
  }
  const target = ballReturn.waypoints[0];
  const dir = new THREE.Vector3().subVectors(target, ballMesh.position);
  const dist = dir.length();
  if (dist < 0.3) {
    ballMesh.position.copy(target);
    ballReturn.waypoints.shift();
    if (ballReturn.waypoints.length === 0) {
      ballReturn.active = false;
      ballReturn.relayFielder = null;
      const done = ballReturn.onDone;
      ballReturn.onDone = null;
      if (done) done();
    } else {
      // Reached a relay point (the cutoff man) — pause before the next throw.
      ballReturn.pause = RELAY_PAUSE;
    }
    return;
  }
  dir.normalize();
  ballMesh.position.addScaledVector(dir, Math.min(ballReturn.speed * dt, dist));
}

// ---------- Throw to first: the infielder's throw racing the runner to the bag ----------
// An infield grounder isn't an out just because it was fielded — the fielder has
// to throw across to the first baseman (who's covering the bag) before the batter
// gets there. The ball flies to first; when it lands we compare the throw's total
// time (time already elapsed + flight time) against the runner's time to first.
const throwToFirst = {
  active: false,
  out: false,        // whether the throw beats the runner (decided when the throw is launched)
  speed: 0,
};

// Distance from home to first, in the runner's own timing units, for the race.
function runnerReachesFirstTime() {
  return speedRatingToTimeToFirst(batterAttributes.speed);
}

// The spot the throw to first is aimed at: the pitcher's cover spot if he's covering
// (the first baseman charged the ball), otherwise the first baseman's cover spot.
function firstBaseThrowTarget() {
  return pitcherCoveringFirst ? PITCHER_FIRST_COVER : FIRST_COVER_POS;
}

// Launches the fielded ball on a throw to first base and locks in whether it beats
// the runner. Whoever's covering first (first baseman, or pitcher if the first
// baseman charged the ball) is already breaking for the bag (see updateFielders).
function startThrowToFirst(fielder) {
  const throwSpeed = throwingRatingToThrowSpeed(fielder.attrs.throwing);
  const throwTime = fielder.mesh.position.distanceTo(firstBaseThrowTarget()) / throwSpeed;
  const defenseTime = hitClock + throwTime;      // whole clock: contact -> field -> ball at first
  throwToFirst.out = defenseTime < runnerReachesFirstTime();
  throwToFirst.speed = throwSpeed;
  throwToFirst.active = true;
}

// A fielder must be within this of the cover spot to be "on the bag" for a putout.
const BAG_COVER_RADIUS = 1.3;

function updateThrowToFirst(dt) {
  if (!throwToFirst.active) return;
  // Aim at the cover spot (the bag), not a fielder's live position — a throw only
  // records an out if it comes to the base and someone's there to catch it on the
  // bag. The covering fielder is the pitcher when the first baseman charged the ball.
  const coverPos = firstBaseThrowTarget();
  const target = new THREE.Vector3(coverPos.x, ballHoldHeight, coverPos.z);
  const dir = new THREE.Vector3().subVectors(target, ballMesh.position);
  const dist = dir.length();
  if (dist < 0.3) {
    ballMesh.position.copy(target);
    throwToFirst.active = false;
    onThrowReachedFirst();
    return;
  }
  dir.normalize();
  ballMesh.position.addScaledVector(dir, Math.min(throwToFirst.speed * dt, dist));
}

// The throw has arrived at first base — call the play.
function onThrowReachedFirst() {
  // An out requires whoever's covering first to actually be on the bag to receive it.
  // Normally that's the first baseman; if he charged the ball, the pitcher covers.
  // If nobody made it to the bag, the batter is safe no matter the throw-vs-runner race.
  const firstBaseman = fielderByPos('1B');
  const caughtByPitcher = pitcherCoveringFirst;
  const onBag = caughtByPitcher
    ? pitcherOnFirst()
    : (firstBaseman && Math.hypot(firstBaseman.mesh.position.x - FIRST_COVER_POS.x,
                                  firstBaseman.mesh.position.z - FIRST_COVER_POS.z) < BAG_COVER_RADIUS);
  if (throwToFirst.out && onBag) {
    runner.active = false; // thrown out before reaching the bag
    showPitchCall('Out!');
    advanceRunnersOnGroundOut(); // runners already running on the ground ball finish the run
    recordOut();
  } else {
    // The runner beat the throw (or nobody covered) for an infield single. Existing
    // runners finish running to the next base (animated); the batter is safe at first.
    showPitchCall('Safe!');
    if (anyRunnersOn()) {
      beginRunnerAdvance(true); // existing runners +1, batter to first — committed on arrival
      advanceBatter();
      endAtBat();
    } else {
      recordHit(1); // no one on: normal placement, the batter's sprite shows him reaching first
    }
  }
  // Get the ball back to the mound. (Unless that out retired the side — then the ball
  // leaves with the teams.)
  if (inningTransition.phase === 'none') {
    if (caughtByPitcher) {
      pitcherReturning = true; // the pitcher has it at first — he jogs it back to the mound himself
    } else {
      // First baseman holds the bag a half-second beat, then throws it back to the pitcher.
      ballReturn.waypoints = [pitcherHandPos()];
      ballReturn.speed = throwingRatingToThrowSpeed(firstBaseman.attrs.throwing);
      ballReturn.pause = RELAY_PAUSE;
      ballReturn.relayFielder = null;
      ballReturn.thrower = firstBaseman; // holds the bag through the beat, released once his throw is away
      ballReturn.onDone = null;
      ballReturn.active = true;
    }
  }
  scheduleResetAfterPlay(1500);
}

// ---------- Force plays & double plays ----------
// With a runner on first, the batter forces everyone ahead of him: the infielder
// goes after the LEAD runner (the force out is easier — the base is thrown to, the
// runner doesn't have to be tagged) and then tries to relay across to first to turn
// two. The lead force base is the top of the consecutive chain of runners starting
// at first: runner on first alone -> force at second; first & second -> third; bases
// loaded -> home. A gap breaks the chain (nobody behind the gap is forced).
const NATURAL_COVER = { second: '2B', third: '3B', home: 'C' }; // who normally covers each force base
const FORCE_FROM = { second: 'first', third: 'second', home: 'third' }; // the runner being forced to each base
const COVER_CANDIDATES = { first: ['1B'], second: ['2B', 'SS'], third: ['3B', 'SS'], home: ['C'] };
const DP_PIVOT_PAUSE = 0.4; // beat at the lead base to show the force before the relay to first

// Cover standing spot for a bag: foot barely on it, on the infield (mound) side,
// facing the incoming throw — same "just touching the bag" look as first base.
function coverPosForBag(bagPos) {
  const toward = new THREE.Vector3().subVectors(moundCenter, bagPos);
  toward.y = 0;
  toward.normalize();
  return bagPos.clone().addScaledVector(toward, BASE_SIZE / 2 + 0.15);
}
const COVER_POS_BY_BASE = {
  first: FIRST_COVER_POS,
  second: coverPosForBag(SECOND),
  third: coverPosForBag(THIRD_BAG_POS),
  home: coverPosForBag(HOME),
};

// ---------- Pitcher covers first ----------
// When the first baseman charges a grounder in his zone he's pulled off the bag, so
// the pitcher sprints over to cover first and take the throw (a 3-1 / 4-3 putout).
const PITCHER_FIRST_COVER = coverPosForBag(FIRST_BAG_POS); // touches the bag from the infield side
const PITCHER_COVER_SPEED = fielderRatingToChaseSpeed(10) * 1.4; // he hustles to beat the throw over
let pitcherCoveringFirst = false; // the pitcher is covering first this play (the 1B is off the bag)
let pitcherReturning = false;     // he took the throw and is carrying the ball back to the mound

// On the bag = horizontal (ground-plane) distance to the cover spot; the player's
// standing height must not count against him.
function pitcherOnFirst() {
  return Math.hypot(pitcherMesh.position.x - PITCHER_FIRST_COVER.x,
                    pitcherMesh.position.z - PITCHER_FIRST_COVER.z) < BAG_COVER_RADIUS;
}

const MOUND_RISE = 0.4; // the pitcher stands this much higher on the mound than on flat ground

function updatePitcherCover(dt) {
  if (inningTransition.phase !== 'none') return; // the transition owns the pitcher's movement
  const covering = pitcherCoveringFirst && !pitcherReturning;
  const targetXZ = covering ? PITCHER_FIRST_COVER : PITCHER_HOME;
  const targetY = covering ? standHeight : standHeight + MOUND_RISE; // grounded at first, raised on the mound
  const to = new THREE.Vector3(targetXZ.x, pitcherMesh.position.y, targetXZ.z);
  const d = new THREE.Vector3().subVectors(to, pitcherMesh.position);
  const dist = d.length();
  if (dist > 0.05) {
    d.normalize();
    pitcherMesh.position.addScaledVector(d, Math.min(PITCHER_COVER_SPEED * dt, dist));
  }
  pitcherMesh.position.y += clamp(targetY - pitcherMesh.position.y, -2 * dt, 2 * dt); // ease on/off the mound
  if (pitcherReturning) {
    ballMesh.position.set(pitcherMesh.position.x, ballHoldHeight, pitcherMesh.position.z); // carries it back
    if (dist < 0.1) pitcherReturning = false; // back on the mound with the ball
  }
}

// The base the lead force out is made at, or null when nobody ahead of the batter
// is forced (first base open) — then it's an ordinary throw across to first.
function leadForceBase() {
  const b = gameState.bases;
  if (!b.first) return null;
  if (!b.second) return 'second';
  if (!b.third) return 'third';
  return 'home';
}

// The fielder who covers a base, avoiding the one who fielded the ball (his middle-
// infield partner takes it instead). Returns null if only the fielder could cover.
function baseCoverFielder(baseKey, fielder) {
  const key = COVER_CANDIDATES[baseKey].find(k => k !== fielder.posKey);
  return key ? fielderByPos(key) : null;
}

// A chain of throws racing runners to force bases: hop 0 is the lead force, an
// optional hop 1 is the relay to first to turn a double play. Each hop's out/safe
// is pre-decided (like throwToFirst) from the throw times vs the runners' times.
const groundPlay = {
  active: false,
  hops: [],      // { baseKey, cover, out, runnerAttrs, isBatter }
  index: 0,
  speed: 0,      // speed of the throw currently in flight
  pauseLeft: 0,  // pivot beat between catching at the lead base and relaying on
};

function startGroundForcePlay(fielder) {
  const leadBase = leadForceBase();
  const leadCover = baseCoverFielder(leadBase, fielder);
  const throwSpeed = throwingRatingToThrowSpeed(fielder.attrs.throwing);
  const leadCoverPos = COVER_POS_BY_BASE[leadBase];
  const tLead = hitClock + fielder.mesh.position.distanceTo(leadCoverPos) / throwSpeed;
  const leadRunner = gameState.bases[FORCE_FROM[leadBase]];
  const leadOut = tLead < speedRatingToTimeToFirst(leadRunner.speed); // lead runner covers one base (60ft)

  // Couldn't beat the lead runner to the bag (or nobody's free to cover it): abandon
  // the force and just throw across to first for the batter — an ordinary fielder's choice.
  if (!leadOut || !leadCover) { startThrowToFirst(fielder); return; }

  const hops = [{ baseKey: leadBase, cover: leadCover, out: true, runnerAttrs: leadRunner, isBatter: false }];

  // Try to turn two: the pivot man at the lead base relays across to first, racing
  // the batter. Skipped with two outs already (the lead force ends the inning) or if
  // the first baseman himself fielded the ball (nobody left to take the bag there).
  const firstCover = baseCoverFielder('first', fielder);
  if (gameState.outs <= 1 && firstCover && firstCover !== leadCover) {
    const relaySpeed = throwingRatingToThrowSpeed(leadCover.attrs.throwing);
    const tFirst = tLead + DP_PIVOT_PAUSE + leadCoverPos.distanceTo(FIRST_COVER_POS) / relaySpeed;
    const firstOut = tFirst < runnerReachesFirstTime();
    hops.push({ baseKey: 'first', cover: firstCover, out: firstOut, runnerAttrs: runner.attrs, isBatter: true });
  }

  groundPlay.hops = hops;
  groundPlay.index = 0;
  groundPlay.speed = throwSpeed; // the fielder's throw into the lead base
  groundPlay.pauseLeft = 0;
  groundPlay.active = true;
}

function updateGroundPlay(dt) {
  if (!groundPlay.active) return;
  const hop = groundPlay.hops[groundPlay.index];
  const glove = hop.cover.mesh.position;
  if (groundPlay.pauseLeft > 0) {
    // Ball held in the pivot man's glove — glue it to him as he settles onto the bag.
    ballMesh.position.set(glove.x, ballHoldHeight, glove.z);
    groundPlay.pauseLeft -= dt;
    if (groundPlay.pauseLeft <= 0) {
      groundPlay.index++;
      groundPlay.speed = throwingRatingToThrowSpeed(hop.cover.attrs.throwing); // pivot man's relay
    }
    return;
  }
  // Aim at the cover fielder's glove (his live position), so a still-arriving cover
  // man is thrown to wherever he is, not to an empty bag.
  const target = new THREE.Vector3(glove.x, ballHoldHeight, glove.z);
  const dir = new THREE.Vector3().subVectors(target, ballMesh.position);
  const dist = dir.length();
  if (dist < 0.3) {
    ballMesh.position.copy(target);
    if (groundPlay.index >= groundPlay.hops.length - 1) resolveGroundPlay();
    else groundPlay.pauseLeft = DP_PIVOT_PAUSE; // caught the force — show it, then relay to first
    return;
  }
  dir.normalize();
  ballMesh.position.addScaledVector(dir, Math.min(groundPlay.speed * dt, dist));
}

// The throws are done — total up the outs, advance the survivors, and post the call.
function resolveGroundPlay() {
  groundPlay.active = false;
  const outHops = groundPlay.hops.filter(h => h.out);
  const numOuts = outHops.length;
  const outRunners = new Set(outHops.map(h => h.runnerAttrs));
  const batterOut = groundPlay.hops.some(h => h.isBatter && h.out);

  // Everyone was running on the grounder, so each existing runner advances a base and
  // the batter heads to first; then remove whoever was forced/thrown out. A runner put
  // out never reaches his base (and a lead runner forced at home never scores).
  const advances = [];
  BASE_ORDER.forEach((k, i) => { const occ = gameState.bases[k]; if (occ) advances.push({ attrs: occ, dest: (i + 1) + 1 }); });
  advances.push({ attrs: runner.attrs, dest: 1 }); // the batter

  const willEndInning = gameState.outs + numOuts >= 3;
  const newBases = { first: null, second: null, third: null };
  let runs = 0;
  for (const a of advances) {
    if (outRunners.has(a.attrs)) continue;
    if (a.dest >= 4) { if (!willEndInning) runs++; }
    else newBases[BASE_ORDER[a.dest - 1]] = a.attrs;
  }

  if (batterOut) runner.active = false; // thrown out at first — stop his sprite short of the bag

  showPitchCall(numOuts >= 2 ? 'Double Play!' : 'Out!');

  gameState.bases = newBases;
  runnerAnim.t = 0;
  runnerAnim.forcedAdvance = false;
  runnerAnim.pending = null;
  syncBaseRunnerMeshes();
  if (runs > 0) gameState[battingTeamScoreKey()] += runs;

  const holder = groundPlay.hops[groundPlay.hops.length - 1].cover; // last man with the ball
  advanceBatter();
  gameState.outs += numOuts;
  if (gameState.outs >= 3) {
    gameState.outs = 0;
    startInningTransition();
    gameState.balls = 0;
    gameState.strikes = 0;
    updateScoreBug();
    scheduleResetAfterPlay(1500);
    return;
  }
  endAtBat();
  // The man holding the ball shows the out a beat, then throws it back to the pitcher.
  ballReturn.waypoints = [pitcherHandPos()];
  ballReturn.speed = throwingRatingToThrowSpeed(holder.attrs.throwing);
  ballReturn.pause = RELAY_PAUSE;
  ballReturn.relayFielder = null;
  ballReturn.thrower = holder;
  ballReturn.onDone = null;
  ballReturn.active = true;
  scheduleResetAfterPlay(1500);
}

// ---------- Unassisted putout at first ----------
// A slow roller down the first base line (or any grounder the first baseman is
// closest to) is his to field — there's no one to throw to at the bag, so he
// carries it over and steps on first himself, racing the batter. Whether he
// beats the runner is pre-decided from his run time, same as a throw.
const firstBasePutout = { active: false, fielder: null, out: false };

function startFirstBasemanPutout(fielder) {
  pitcherCoveringFirst = false; // the first baseman has it and will take the bag himself; pitcher returns
  const runSpeed = fielderRatingToChaseSpeed(fielder.attrs.speed);
  const runTime = fielder.mesh.position.distanceTo(FIRST_COVER_POS) / runSpeed;
  firstBasePutout.out = hitClock + runTime < runnerReachesFirstTime();
  firstBasePutout.fielder = fielder;
  firstBasePutout.active = true;
}

function updateFirstBasePutout(dt) {
  if (!firstBasePutout.active) return;
  const f = firstBasePutout.fielder;
  const target = new THREE.Vector3(FIRST_COVER_POS.x, f.mesh.position.y, FIRST_COVER_POS.z);
  const toBag = new THREE.Vector3().subVectors(target, f.mesh.position);
  const dist = toBag.length();
  if (dist > 0.05) {
    toBag.normalize();
    f.mesh.position.addScaledVector(toBag, Math.min(fielderRatingToChaseSpeed(f.attrs.speed) * dt, dist));
  }
  ballMesh.position.set(f.mesh.position.x, ballHoldHeight, f.mesh.position.z); // ball carried in his glove
  if (dist < 0.15) {
    firstBasePutout.active = false;
    onFirstBasemanReachedBag();
  }
}

// The first baseman has run to the bag — call the play (same out/safe handling as
// a throw across), then he throws the ball back to the pitcher.
function onFirstBasemanReachedBag() {
  const f = firstBasePutout.fielder;
  if (firstBasePutout.out) {
    runner.active = false;
    showPitchCall('Out!');
    advanceRunnersOnGroundOut();
    recordOut();
  } else {
    showPitchCall('Safe!');
    if (anyRunnersOn()) {
      beginRunnerAdvance(true);
      advanceBatter();
      endAtBat();
    } else {
      recordHit(1);
    }
  }
  if (inningTransition.phase === 'none') {
    ballReturn.waypoints = [pitcherHandPos()];
    ballReturn.speed = throwingRatingToThrowSpeed(f.attrs.throwing);
    ballReturn.pause = RELAY_PAUSE;
    ballReturn.relayFielder = null;
    ballReturn.thrower = f; // holds the bag through the beat, then throws it in
    ballReturn.onDone = null;
    ballReturn.active = true;
  }
  scheduleResetAfterPlay(1500);
}

// A fielder has reached the ball.
//  - Caught in the air  -> automatic out (the pre-rolled fly out / pop out).
//  - Fielded off the ground by an infielder -> throw across to first, race the runner.
//  - Fielded in the outfield (or off the wall) -> the pre-rolled hit stands.
function fieldBall(fielder, caught) {
  if (inPlay.resolved) return;
  inPlay.resolved = true;
  inPlay.velocity.set(0, 0, 0);
  ballMesh.position.copy(fielder.mesh.position);
  ballMesh.position.y = Math.max(BALL_RADIUS, ballMesh.position.y);

  if (caught) {
    runner.active = false;
    showPitchCall('Out!');
    recordOut();
    // An outfielder holds a caught fly a beat before throwing it back in when
    // there's no one on base to hurry the throw for. An infielder catching a pop
    // fly always holds a half-second beat before the throw back to the pitcher.
    const isOutfielder = OUTFIELD_POSITIONS.includes(fielder.posKey);
    const holdBeat = isOutfielder ? (basesEmpty() ? 0.5 : 0) : 0.5;
    startBallReturn(fielder, holdBeat);
    scheduleResetAfterPlay(3000);
    return;
  }

  const isInfielder = !OUTFIELD_POSITIONS.includes(fielder.posKey);
  if (isInfielder && !inPlay.touchedFence) {
    // Ground ball to an infielder. With a runner forced ahead of the batter, go
    // after the lead runner (and try to turn two). Otherwise it's a play at first:
    // the first baseman fielding it himself carries it to the bag unassisted (no one
    // to throw to), while any other infielder throws across — and if the first baseman
    // charged the ball, the pitcher (already breaking over) covers the bag for the throw.
    if (leadForceBase()) startGroundForcePlay(fielder);
    else if (fielder.posKey === '1B') startFirstBasemanPutout(fielder);
    else startThrowToFirst(fielder);
    return;
  }

  // Fielded in the outfield or off the wall — the pre-rolled hit stands, and
  // the batter has been running for it since contact. Only if the result had
  // to change (a called 4 that stayed in the park settles for a triple; a
  // called out that somehow reached the outfield becomes a single) does the
  // runner get redirected here.
  const bases = Math.max(1, Math.min(inPlay.calledBases, 3));
  if (bases !== inPlay.calledBases) sendRunnerToBase(bases);
  showPitchCall(bases === 1 ? 'Single!' : bases === 2 ? 'Double!' : 'Triple!');
  recordHit(bases);
  startHitBallReturn(fielder);
  scheduleResetAfterPlay(3000);
}

// After a base hit is fielded in the outfield, the ball still has to come back
// in: the fielder throws to the nearest infielder, who pauses a beat and then
// throws it back to the pitcher.
function startHitBallReturn(fielder) {
  const waypoints = [];
  let relayFielder = null;
  if (OUTFIELD_POSITIONS.includes(fielder.posKey)) {
    relayFielder = INFIELD_KEYS.map(fielderByPos).reduce((a, b) =>
      a.mesh.position.distanceTo(fielder.mesh.position) <= b.mesh.position.distanceTo(fielder.mesh.position) ? a : b);
    // Freeze the relay man where he stands right now — the throw is aimed there.
    waypoints.push(new THREE.Vector3(relayFielder.mesh.position.x, ballHoldHeight, relayFielder.mesh.position.z));
  }
  waypoints.push(pitcherHandPos());
  ballReturn.waypoints = waypoints;
  ballReturn.speed = throwingRatingToThrowSpeed(fielder.attrs.throwing);
  ballReturn.pause = 0;
  ballReturn.relayFielder = relayFielder;
  ballReturn.thrower = null;
  ballReturn.onDone = null;
  ballReturn.active = true;
}

// Keeps a point from crossing to the far side of any outfield fence segment —
// used to stop fielders from running through the wall while chasing a ball.
function clampToPlayableField(pos) {
  for (const seg of fenceSegments) {
    const segDir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();
    const segLen = seg.start.distanceTo(seg.end);
    let normal = new THREE.Vector3(-segDir.z, 0, segDir.x); // perpendicular to the fence
    // Orient inward, back toward home plate (same convention as the ball's fence-bounce code).
    const fromStart = new THREE.Vector3().subVectors(HOME, seg.start);
    if (fromStart.dot(normal) < 0) normal.negate();

    const rel = new THREE.Vector3().subVectors(pos, seg.start);
    const t = rel.dot(segDir);
    if (t < 0 || t > segLen) continue; // this segment's span doesn't cover this point
    const inwardDist = rel.dot(normal);
    const buffer = seg.thickness / 2 + PLAYER_RADIUS;
    if (inwardDist < buffer) {
      pos.addScaledVector(normal, buffer - inwardDist);
    }
  }
  return pos;
}

// A ball headed farther than this from home (past the deepest infielder) is an
// outfield play — infielders stop chasing and set up the relay instead.
const OUTFIELD_PLAY_DIST = 135 * FT;
const CUTOFF_DIST = 125 * FT; // how far past home the cutoff man sets up

// On an outfield play the infielders take relay/cover assignments rather than
// chasing the ball: one middle infielder becomes the cutoff man, lined up between
// the ball and home a little past the infield, while the other covers second and
// the corners/catcher hold their bags. A ball to right field (the first-base side)
// uses the second baseman as cutoff; center or left field uses the shortstop.
function relayAlignment(ballTarget) {
  const toRight = ballTarget.x < 0; // +X is toward third/left field, so -X is right field
  let dir = new THREE.Vector3(ballTarget.x - HOME.x, 0, ballTarget.z - HOME.z);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();
  const cutoffPos = new THREE.Vector3().copy(HOME).addScaledVector(dir, CUTOFF_DIST);
  const covers = {
    '1B': new THREE.Vector3(FIRST.x, 0, FIRST.z),
    '3B': new THREE.Vector3(THIRD.x, 0, THIRD.z),
    C:    new THREE.Vector3(HOME.x, 0, HOME.z),
  };
  if (toRight) {
    covers['2B'] = cutoffPos;                                                   // cutoff man
    covers['SS'] = new THREE.Vector3(SECOND.x + 4 * FT, 0, SECOND.z + 5 * FT);  // covers second, behind the bag toward third
  } else {
    covers['SS'] = cutoffPos;                                                   // cutoff man
    covers['2B'] = new THREE.Vector3(SECOND.x - 4 * FT, 0, SECOND.z + 5 * FT);  // covers second, behind the bag toward first
  }
  return { cutoffKey: toRight ? '2B' : 'SS', covers };
}

// The base a given infielder covers on a pop fly he isn't catching. The two
// middle infielders both cover second, offset to opposite sides of the bag.
function infieldCoverSpot(posKey) {
  switch (posKey) {
    case '1B': return FIRST;
    case '3B': return THIRD;
    case 'C':  return HOME;
    case '2B': return new THREE.Vector3(SECOND.x - 4 * FT, 0, SECOND.z);
    case 'SS': return new THREE.Vector3(SECOND.x + 4 * FT, 0, SECOND.z);
    default:   return SECOND;
  }
}

// Which infielder has called for the current pop fly. Latched for the whole
// flight so a ball landing between two fielders doesn't make the "closest" flip
// frame to frame and draw several of them toward it.
let infieldFlyCatcher = null;

// Latched true once the first baseman is the infielder closest to a grounder: it's
// his ball, so he charges it instead of camping on the bag, then makes the putout
// himself. Reset each pitch. (See resetPitchToPitcher.)
let firstBasemanCharging = false;

// Whether the ball is in the first baseman's zone — judged by fielders' HOME
// positions (his live position drifts to the bag once he starts covering, which
// would wrongly disqualify him). The catcher is in the pool so dribblers in front
// of the plate go to the catcher and the first baseman only leaves his bag for
// balls genuinely down his line.
const CHARGE_POOL = [...INFIELD_KEYS, 'C'];
function firstBasemanClaims(pos) {
  const closest = CHARGE_POOL.map(fielderByPos).reduce((a, b) =>
    Math.hypot(a.homePos.x - pos.x, a.homePos.z - pos.z) <=
    Math.hypot(b.homePos.x - pos.x, b.homePos.z - pos.z) ? a : b);
  return closest.posKey === '1B';
}

// The bag (cover position) a fielder should run to on a ground ball, or null.
// During a force/DP the assigned cover men take their bases; otherwise the first
// baseman alone plays first for the throw across — unless he's charging the ball
// to field it himself, in which case he doesn't cover.
function groundCoverTargetFor(f, firstBaseCoverActive) {
  if (f.posKey === '1B' && firstBasemanCharging) return null; // his ball to field, not cover
  if (groundPlay.active) {
    for (const hop of groundPlay.hops) if (hop.cover === f) return COVER_POS_BY_BASE[hop.baseKey];
    if (f.posKey === '1B') return FIRST_COVER_POS; // keep him home-side even on a lead-only out
    return null;
  }
  return f.posKey === '1B' && firstBaseCoverActive ? FIRST_COVER_POS : null;
}

// Moves each fielder toward the ball (or its cover/relay spot) while it's live,
// has them catch/field it when close enough, and sends them home otherwise.
function updateFielders(dt) {
  if (inningTransition.phase !== 'none') return; // the transition owns everyone's movement
  const chasing = inPlay.active && !inPlay.resolved;
  // Outfielders read the ball off the bat and break toward where it's going to land.
  const landingSpot = (chasing && !inPlay.touchedGround && !inPlay.touchedFence) ? predictLandingSpot() : null;
  const ballTarget = landingSpot || ballMesh.position;
  const outfieldPlay = chasing && !inPlay.touchedFence && distToHome(ballTarget) > OUTFIELD_PLAY_DIST;
  const align = outfieldPlay ? relayAlignment(ballTarget) : null;
  // A pop fly staying in the infield: the infielders break to where it'll come
  // down (chasing the ball's low early position would draw them in too far and
  // let it drop behind them), and the outfielders hold rather than charging in.
  const infieldFly = !!landingSpot && !outfieldPlay;
  // On a pop fly, only one infielder (or catcher) goes for the ball; the rest
  // cover their bases. Latch the caller on the first frame and keep him for the
  // whole flight so nobody else drifts over.
  if (infieldFly) {
    if (!infieldFlyCatcher) {
      const pool = fielders.filter(f => !OUTFIELD_POSITIONS.includes(f.posKey));
      infieldFlyCatcher = pool.reduce((a, b) =>
        Math.hypot(a.mesh.position.x - landingSpot.x, a.mesh.position.z - landingSpot.z) <=
        Math.hypot(b.mesh.position.x - landingSpot.x, b.mesh.position.z - landingSpot.z) ? a : b);
    }
  } else {
    infieldFlyCatcher = null; // play's not a pop fly (any more): clear for next time
  }
  const flyCatcher = infieldFlyCatcher;
  // On an infield grounder the first baseman plays the bag to take the throw.
  const infieldGrounder = chasing && inPlay.touchedGround && !inPlay.touchedFence && !outfieldPlay;
  const firstBaseCoverActive = throwToFirst.active || infieldGrounder;
  // If a low ball (grounder or already-bounced) in the first baseman's zone is his,
  // latch him as the charger the moment it's read — before he wastes time drifting to
  // cover the bag — so he commits straight to the ball. Latched until the pitch resets,
  // or cleared if someone else gets to it first.
  if (chasing && !inPlay.touchedFence && !outfieldPlay &&
      ballMesh.position.y < CAPSULE_TOTAL_HEIGHT && firstBasemanClaims(ballTarget)) {
    firstBasemanCharging = true;
    pitcherCoveringFirst = true; // he's off the bag, so the pitcher breaks over to cover first
  }

  for (const f of fielders) {
    // The first baseman running the ball to the bag for an unassisted putout owns his
    // own movement (updateFirstBasePutout) — don't fight it here.
    if (firstBasePutout.active && firstBasePutout.fielder === f) continue;
    // The cutoff man holds his spot until he's taken the relay throw and sent it on to the pitcher.
    if (ballReturn.active && (ballReturn.relayFielder === f || ballReturn.thrower === f)) continue;
    const isOutfielder = OUTFIELD_POSITIONS.includes(f.posKey);
    const relayInfielder = !!align && !isOutfielder; // infielder on cutoff/cover duty
    // Bag this fielder should cover, if any: a force/DP cover during the throw
    // sequence, or the first baseman taking an ordinary throw across.
    const coverPos = groundCoverTargetFor(f, firstBaseCoverActive);
    let target;
    if (coverPos) {
      // Stand just inside the bag (foot on the edge) and hold there for the throw.
      // Checked before !chasing: the instant the grounder is fielded, chasing flips
      // false, and this keeps the cover men on their bags through the throws instead
      // of jogging home mid-play.
      target = new THREE.Vector3(coverPos.x, f.mesh.position.y, coverPos.z);
    } else if (firstBasemanCharging && f.posKey === 'C') {
      target = f.homePos; // the first baseman is charging this one; the catcher stays put
    } else if (!chasing) {
      target = f.homePos;
    } else if (isOutfielder) {
      if (infieldFly) {
        // Pop fly to the infield — hold; the infielders make the catch.
        target = f.homePos;
      } else if (landingSpot) {
        // Hold position for a beat while reading the ball off the bat, then break for the landing spot.
        target = hitClock < OUTFIELDER_REACTION_DELAY
          ? f.homePos
          : new THREE.Vector3(landingSpot.x, f.mesh.position.y, landingSpot.z);
      } else {
        target = new THREE.Vector3(ballMesh.position.x, f.mesh.position.y, ballMesh.position.z);
      }
    } else if (relayInfielder) {
      const spot = align.covers[f.posKey];
      target = new THREE.Vector3(spot.x, f.mesh.position.y, spot.z);
    } else if (infieldFly) {
      if (f === flyCatcher) {
        // Only the closest infielder settles under the pop fly for the catch.
        target = new THREE.Vector3(landingSpot.x, f.mesh.position.y, landingSpot.z);
      } else {
        // Everyone else covers their base.
        const spot = infieldCoverSpot(f.posKey);
        target = new THREE.Vector3(spot.x, f.mesh.position.y, spot.z);
      }
    } else {
      target = new THREE.Vector3(ballMesh.position.x, f.mesh.position.y, ballMesh.position.z);
    }
    const toTarget = new THREE.Vector3().subVectors(target, f.mesh.position);
    const dist = toTarget.length();
    if (dist > 0.05) {
      toTarget.normalize();
      const spd = fielderRatingToChaseSpeed(f.attrs.speed);
      f.mesh.position.addScaledVector(toTarget, Math.min(spd * dt, dist));
      clampToPlayableField(f.mesh.position);
    }

    // Cutoff/cover infielders don't field the ball themselves — the outfielder
    // does; and on a pop fly, only the designated catcher makes the play.
    if (chasing && !relayInfielder && !(infieldFly && f !== flyCatcher)) {
      const horizDist = Math.hypot(f.mesh.position.x - ballMesh.position.x, f.mesh.position.z - ballMesh.position.z);
      // Air catches only happen on plays called as outs — a ball called a hit
      // always finds grass (or the wall), so a nearby fielder plays it on the
      // hop instead of turning a called single into a catch. A ball that's
      // touched the fence is a live ball off the wall, no longer catchable.
      if (inPlay.calledBases === 0 &&
          !inPlay.touchedGround && !inPlay.touchedFence && horizDist < FIELDER_CATCH_RADIUS && ballMesh.position.y <= FIELDER_CATCH_HEIGHT) {
        fieldBall(f, true);
        return;
      }
      if ((inPlay.touchedGround || inPlay.touchedFence) && horizDist < FIELDER_FIELD_RADIUS) {
        fieldBall(f, false);
        return;
      }
    }
  }
}

function updateBallInPlay(dt) {
  if (!inPlay.active || inPlay.resolved) return;

  // Real time elapsed since contact — keep counting even while the ball is at
  // rest, since a fielder is still jogging over to pick it up. Freezing it here
  // (the old bug) let a slow roller's throw-to-first race use a stale, far-too-
  // small defensive time and call a runner out who clearly beat the throw.
  hitClock += dt;

  if (inPlay.resting) return;

  inPlay.prevPos.copy(ballMesh.position);
  inPlay.velocity.y += GRAVITY * dt;
  ballMesh.position.addScaledVector(inPlay.velocity, dt);

  // Ground collision: bounce with energy loss, plus rolling friction
  if (ballMesh.position.y <= BALL_RADIUS) {
    ballMesh.position.y = BALL_RADIUS;
    inPlay.velocity.y *= -0.4; // lose energy on bounce
    inPlay.velocity.x *= 0.7;
    inPlay.velocity.z *= 0.7;
    inPlay.touchedGround = true;
  }

  checkHomeRun();
  checkFenceCollision();

  if (inPlay.velocity.length() < RESTING_SPEED && ballMesh.position.y <= BALL_RADIUS + 0.01) {
    inPlay.velocity.set(0, 0, 0);
    inPlay.resting = true;
    // Don't resolve the play just because the ball stopped rolling — leave it live so
    // updateFielders() keeps converging on it and fieldBall() decides the outcome (out,
    // single, double, or triple) the instant someone actually picks it up, exactly like
    // a ball that's still moving. A weak roller a few feet in front of home has no reason
    // to become an automatic double just because nobody was standing on it yet.
  }
}


let swungThisPitch = false;

const pitch = {
  inFlight: false,
  resetting: false,
  startPos: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
};
// ---------- Throwing rating -> ball speed (1 -> 60mph, 10 -> 90mph) ----------
// Shared by pitches and fielder throws to first base.
function throwingRatingToThrowSpeed(rating) {
  const mph = 60 + ((rating - 1) / 9) * (90 - 60); // linear interpolation
  return mph * 1.467 * FT; // mph -> ft/s -> world units/s
}
const PLATE_DEPTH = 1.4; // matches the home plate shape's depth, used for foul lines too
const PITCH_HEIGHT_SPREAD = CAPSULE_TOTAL_HEIGHT * 0.4; // how far above/below the middle a pitch can arrive

function throwPitch() {
  if (pitch.inFlight || pitch.resetting || inPlay.active) return;
  if (inningTransition.phase !== 'none') return; // teams are still swapping sides
  showNameCards();
  swungThisPitch = false;
  pitch.inFlight = true;
  pitch.startPos.copy(ballMesh.position);

  // Travel through home plate and 4ft past the back of it (the plate's point/tip,
  // which faces the backstop). Pitches arrive at varying heights — up in the
  // zone, down at the knees — instead of always on one flat plane.
  const dirToHomeXZ = new THREE.Vector3(HOME.x - pitch.startPos.x, 0, HOME.z - pitch.startPos.z).normalize();
  const overshoot = PLATE_DEPTH + 4 * FT;
  const targetHeight = ballHoldHeight + (Math.random() - 0.5) * 2 * PITCH_HEIGHT_SPREAD;
  const target = new THREE.Vector3(
    HOME.x + dirToHomeXZ.x * overshoot,
    targetHeight,
    HOME.z + dirToHomeXZ.z * overshoot
  );

  const dir3D = new THREE.Vector3().subVectors(target, pitch.startPos).normalize();
  pitch.velocity.copy(dir3D).multiplyScalar(throwingRatingToThrowSpeed(pitcherAttributes.throwing));
  pitch.target = target;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    throwPitch();
  }
});

// ---------- Gameplay camera: batting view behind home plate, switches to a ----------
// ---------- zoomed-out ball-follow view once the ball is hit into play. ----------
const PLATE_DEPTH_REF = 1.4; // matches the plate's depth used elsewhere

const camBattingPos = new THREE.Vector3(
  HOME.x,
  22 * FT,
  HOME.z - PLATE_DEPTH_REF - 30 * FT
);
const camBattingLookAt = new THREE.Vector3(
  HOME.x,
  2 * FT,
  moundCenter.z * 0.85
);

const camCurrentLookAt = camBattingLookAt.clone();
camera.position.copy(camBattingPos);
camera.lookAt(camCurrentLookAt);

// How far from home plate counts as "still in the infield" — just past the bases.
const INFIELD_RADIUS = BASE_DIST * 1.6;

const followCam = {
  mode: 'tracking',   // 'tracking' while the ball is in the infield, 'zoomingOut' once it leaves
  zoomOutElapsed: 0,
  anchorLookAt: new THREE.Vector3(),
};

function updateCamera(dt) {
  let desiredPos, desiredLookAt, lerpSpeed;

  if (inPlay.homerunCalled) {
    // Home run: follow the batter rounding the bases until they cross home.
    desiredPos = new THREE.Vector3(
      batterMesh.position.x,
      batterMesh.position.y + 30 * FT,
      batterMesh.position.z - 34 * FT
    );
    desiredLookAt = batterMesh.position;
    lerpSpeed = 3;
    followCam.mode = 'tracking';
  } else if (inPlay.active) {
    const distFromHome = Math.hypot(ballMesh.position.x - HOME.x, ballMesh.position.z - HOME.z);

    if (followCam.mode === 'tracking' && distFromHome > INFIELD_RADIUS) {
      // Ball just left the infield — stop chasing it and start a slow continuous zoom-out.
      followCam.mode = 'zoomingOut';
      followCam.zoomOutElapsed = 0;
      followCam.anchorLookAt.copy(ballMesh.position);
    }

    if (followCam.mode === 'tracking') {
      // Wide, high angle over the ball while it's still around the infield.
      desiredPos = new THREE.Vector3(
        ballMesh.position.x,
        ballMesh.position.y + 48 * FT,
        ballMesh.position.z - 42 * FT
      );
      desiredLookAt = ballMesh.position;
      lerpSpeed = 4;
    } else {
      // Slowly keep pulling back from the spot where the ball left the infield.
      followCam.zoomOutElapsed += dt;
      const growth = 1 + followCam.zoomOutElapsed * 0.12; // gentle, continuous zoom-out
      desiredPos = new THREE.Vector3(
        followCam.anchorLookAt.x,
        followCam.anchorLookAt.y + 55 * FT * growth,
        followCam.anchorLookAt.z - 50 * FT * growth
      );
      desiredLookAt = followCam.anchorLookAt;
      lerpSpeed = 1.5;
    }
  } else {
    // Back to the tight batting view, behind home plate.
    desiredPos = camBattingPos;
    desiredLookAt = camBattingLookAt;
    followCam.mode = 'tracking';
    lerpSpeed = 3;
  }

  const alpha = 1 - Math.pow(0.001, dt * (lerpSpeed / 3));
  camera.position.lerp(desiredPos, alpha);
  camCurrentLookAt.lerp(desiredLookAt, alpha);
  camera.lookAt(camCurrentLookAt);
}

const clock = new THREE.Clock();

function animate() {
  const dt = clock.getDelta();

  if (swing.active) {
    swing.t += dt;
    const progress = Math.min(swing.t / swing.duration, 1);
    // Ease through the swing arc from resting position to full extension and back
    const arc = Math.sin(progress * Math.PI); // 0 -> 1 -> 0
    batGroup.rotation.y = BAT_REST_ROT + (BAT_SWING_ROT - BAT_REST_ROT) * arc;
    checkSwingCollision();
    if (progress >= 1) {
      swing.active = false;
      batGroup.rotation.y = BAT_REST_ROT;
    }
  }

  if (pitch.inFlight && !inPlay.active) {
    ballMesh.position.addScaledVector(pitch.velocity, dt);
    const traveled = ballMesh.position.distanceTo(pitch.startPos);
    const totalDist = pitch.startPos.distanceTo(pitch.target);
    if (traveled >= totalDist) {
      ballMesh.position.copy(pitch.target);
      pitch.inFlight = false;
      pitch.resetting = true;
      showPitchCall(swungThisPitch ? 'Strike!' : 'Ball!');
      if (swungThisPitch) {
        gameState.strikes++;
        if (gameState.strikes >= 3) recordOut(); // strikeout
        else updateScoreBug();
      } else {
        gameState.balls++;
        if (gameState.balls >= 4) recordWalk(); // walk, no out
        else updateScoreBug();
      }
      // Catcher gathers the pitch, then throws it back to the pitcher. pitch.resetting
      // stays true (blocking the next pitch) until the throw lands in his hand.
      if (inningTransition.phase === 'none') {
        setTimeout(startCatcherReturn, 300); // brief beat before the catcher throws it back
      } else {
        pitch.resetting = false; // strikeout ended the inning — the teams are swapping
      }
    }
  }

  updateRunner(dt);
  updateBallInPlay(dt);
  updateFielders(dt);
  updateBaseRunnerAnim(dt);
  updateThrowToFirst(dt);
  updateGroundPlay(dt);
  updateFirstBasePutout(dt);
  updatePitcherCover(dt);
  updateBallReturn(dt);
  updateInningTransition(dt);
  updateCamera(dt);
  updateNameCards();

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
showNameCards(); // show once at the very start, before the first pitch
