import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Sky,
  PerspectiveCamera,
  Environment,
  MeshReflectorMaterial,
  Sparkles,
  Billboard,
  Text,
} from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import * as THREE from "three";
import { useListLocations, useGetTeamRoster } from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CloudSun, MapPin, Wind, Play, Pause, RotateCcw } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const GRAVITY = -9.81;
const NET_HEIGHT = 2.24;
const COURT_HALF_X = 9;
const COURT_HALF_Z = 4.5;
const BALL_RADIUS = 0.21;
const RESTITUTION = 0.55;
const DRAG = 0.994;
const PLAYER_SPEED = 4.5;
const HIT_RANGE = 1.4;
const PLAYER_HEIGHT = 1.75;
const PLAYER_REACH = PLAYER_HEIGHT + 0.5;

interface BallPhysics {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  angVel: THREE.Vector3;
  onGround: boolean;
  bounceCount: number;
  lastHitter: "home" | "away";
  inPlay: boolean;
}

interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  jumpT: number;     // 0..1 jump animation progress
  hitT: number;      // 0..1 hit arm swing progress
  isJumping: boolean;
  facingAngle: number;
}

// ── Ball shadow ring that projects onto sand ────────────────────────────────
function BallShadowRing({ ballPos }: { ballPos: THREE.Vector3 }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(ballPos.x, 0.01, ballPos.z);
    const height = Math.max(0.1, ballPos.y);
    const scale = Math.max(0.1, 1 - height / 8);
    ref.current.scale.setScalar(scale);
    const mat = ref.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 * scale;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.55, 32]} />
      <meshBasicMaterial color="#2a1a00" transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

// ── Volleyball (realistic panel seams via UV / color zones) ─────────────────
function Ball({ physRef }: { physRef: React.MutableRefObject<BallPhysics> }) {
  const groupRef = useRef<THREE.Group>(null!);
  const trailRef = useRef<THREE.Mesh[]>([]);
  const trailPositions = useRef<THREE.Vector3[]>(
    Array.from({ length: 8 }, () => new THREE.Vector3())
  );
  const trailIdx = useRef(0);

  useFrame((_, dt) => {
    const b = physRef.current;
    if (!groupRef.current) return;
    groupRef.current.position.copy(b.pos);
    // rotate according to angular velocity
    groupRef.current.rotation.x += b.angVel.x * dt;
    groupRef.current.rotation.y += b.angVel.y * dt;
    groupRef.current.rotation.z += b.angVel.z * dt;

    // update trail
    trailPositions.current[trailIdx.current % 8].copy(b.pos);
    trailIdx.current++;
    trailRef.current.forEach((m, i) => {
      if (!m) return;
      const idx = (trailIdx.current - i - 1 + 8) % 8;
      m.position.copy(trailPositions.current[idx]);
      const alpha = (8 - i) / 8;
      (m.material as THREE.MeshBasicMaterial).opacity = alpha * 0.18;
      const s = (1 - i / 8) * BALL_RADIUS * 1.6;
      m.scale.setScalar(s);
    });
  });

  return (
    <>
      {/* Trail */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} ref={(el) => { if (el) trailRef.current[i] = el; }}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* Ball */}
      <group ref={groupRef}>
        {/* White base panels */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[BALL_RADIUS, 64, 64]} />
          <meshStandardMaterial
            color="#f5f0e8"
            roughness={0.15}
            metalness={0.0}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Coloured panel 1 */}
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS + 0.001, 64, 64, 0, Math.PI * 0.7, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#1d4ed8" roughness={0.15} side={THREE.FrontSide} />
        </mesh>
        {/* Coloured panel 2 */}
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS + 0.001, 64, 64, Math.PI * 0.8, Math.PI * 0.7, Math.PI * 0.5, Math.PI * 0.5]} />
          <meshStandardMaterial color="#dc2626" roughness={0.15} side={THREE.FrontSide} />
        </mesh>
        {/* Coloured panel 3 */}
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS + 0.001, 64, 64, Math.PI * 0.3, Math.PI * 0.6, Math.PI * 0.55, Math.PI * 0.45]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.15} side={THREE.FrontSide} />
        </mesh>
        {/* Specular highlight sphere */}
        <mesh>
          <sphereGeometry args={[BALL_RADIUS * 1.005, 32, 32]} />
          <meshStandardMaterial transparent opacity={0.08} roughness={0} metalness={0.8} color="white" />
        </mesh>
      </group>
    </>
  );
}

// ── Articulated Player ───────────────────────────────────────────────────────
function Player({
  state,
  teamColor,
  accentColor,
  number,
  side,
}: {
  state: PlayerState;
  teamColor: string;
  accentColor: string;
  number: string;
  side: "home" | "away";
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const torsoRef = useRef<THREE.Mesh>(null!);
  const headRef = useRef<THREE.Mesh>(null!);
  const armLRef = useRef<THREE.Group>(null!);
  const armRRef = useRef<THREE.Group>(null!);
  const legLRef = useRef<THREE.Group>(null!);
  const legRRef = useRef<THREE.Group>(null!);
  const shadowRef = useRef<THREE.Mesh>(null!);

  useFrame((_, dt) => {
    const s = state;
    if (!groupRef.current) return;

    groupRef.current.position.lerp(s.pos, 8 * dt);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      s.facingAngle,
      10 * dt
    );

    const t = state.hitT;
    const jt = state.jumpT;
    const walkCycle = Date.now() / 400;
    const isMoving = s.vel.length() > 0.3;

    // Arms
    if (armRRef.current) {
      const hitAngle = t > 0 ? -Math.PI * 1.1 * Math.sin(t * Math.PI) : 0;
      const walkAngle = isMoving ? Math.sin(walkCycle) * 0.3 : 0;
      armRRef.current.rotation.x = hitAngle + walkAngle;
    }
    if (armLRef.current) {
      const walkAngle = isMoving ? -Math.sin(walkCycle) * 0.3 : 0;
      armLRef.current.rotation.x = walkAngle;
    }
    // Legs
    if (legLRef.current) {
      const walkAngle = isMoving ? Math.sin(walkCycle) * 0.35 : 0;
      const jumpAngle = jt > 0 ? Math.PI * 0.15 * Math.sin(jt * Math.PI) : 0;
      legLRef.current.rotation.x = walkAngle + jumpAngle;
    }
    if (legRRef.current) {
      const walkAngle = isMoving ? -Math.sin(walkCycle) * 0.35 : 0;
      const jumpAngle = jt > 0 ? Math.PI * 0.15 * Math.sin(jt * Math.PI) : 0;
      legRRef.current.rotation.x = walkAngle + jumpAngle;
    }

    // Body crouch / stretch on jump
    if (torsoRef.current) {
      const jumpStretch = jt > 0 ? 1 + 0.15 * Math.sin(jt * Math.PI) : 1;
      torsoRef.current.scale.y = jumpStretch;
    }

    // Shadow
    if (shadowRef.current) {
      shadowRef.current.position.set(groupRef.current.position.x, 0.01, groupRef.current.position.z);
    }
  });

  const skinColor = "#f4c08a";
  const shoeColor = "#1a1a1a";
  const shortColor = accentColor;

  return (
    <>
      {/* Ground shadow */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.65, 1]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#1a0d00" transparent opacity={0.28} depthWrite={false} />
      </mesh>

      <group ref={groupRef} position={state.pos.toArray()}>
        {/* Jersey number billboard */}
        <Billboard position={[0, 2.2, 0]}>
          <Text fontSize={0.22} color="white" outlineWidth={0.02} outlineColor="#00000088">
            #{number}
          </Text>
        </Billboard>

        {/* Shoes */}
        <mesh position={[-0.18, 0.12, 0]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.3]} />
          <meshStandardMaterial color={shoeColor} roughness={0.9} />
        </mesh>
        <mesh position={[0.18, 0.12, 0]} castShadow>
          <boxGeometry args={[0.18, 0.12, 0.3]} />
          <meshStandardMaterial color={shoeColor} roughness={0.9} />
        </mesh>

        {/* Legs */}
        <group ref={legLRef} position={[-0.18, 0.68, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.55, 4, 8]} />
            <meshStandardMaterial color={shortColor} roughness={0.8} />
          </mesh>
          {/* shin */}
          <mesh position={[0, -0.72, 0.04]} castShadow>
            <capsuleGeometry args={[0.09, 0.38, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
        </group>
        <group ref={legRRef} position={[0.18, 0.68, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.55, 4, 8]} />
            <meshStandardMaterial color={shortColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.72, 0.04]} castShadow>
            <capsuleGeometry args={[0.09, 0.38, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
        </group>

        {/* Torso (jersey) */}
        <mesh ref={torsoRef} position={[0, 1.08, 0]} castShadow>
          <capsuleGeometry args={[0.28, 0.55, 4, 12]} />
          <meshStandardMaterial color={teamColor} roughness={0.7} metalness={0.05} />
        </mesh>

        {/* Arms */}
        <group ref={armLRef} position={[-0.38, 1.25, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.38, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
          {/* forearm */}
          <mesh position={[0, -0.54, 0.04]} castShadow>
            <capsuleGeometry args={[0.085, 0.32, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
        </group>
        <group ref={armRRef} position={[0.38, 1.25, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.38, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.54, 0.04]} castShadow>
            <capsuleGeometry args={[0.085, 0.32, 4, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.6} />
          </mesh>
        </group>

        {/* Neck */}
        <mesh position={[0, 1.5, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.15, 4, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 1.73, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.22, 32, 32]} />
            <meshStandardMaterial color={skinColor} roughness={0.55} metalness={0.0} />
          </mesh>
          {/* ponytail */}
          <mesh position={[0, 0.04, -0.22]} rotation={[0.4, 0, 0]} castShadow>
            <capsuleGeometry args={[0.055, 0.28, 4, 8]} />
            <meshStandardMaterial color="#3d1c00" roughness={0.9} />
          </mesh>
          {/* visor */}
          <mesh position={[0, 0.08, 0.17]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.3, 0.05, 0.14]} />
            <meshStandardMaterial color={accentColor} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </>
  );
}

// ── Detailed Beach Court ─────────────────────────────────────────────────────
function BeachCourt({ sandColor }: { sandColor: string }) {
  const NET_SEGMENTS = 18;
  const NET_ROWS = 6;

  return (
    <group>
      {/* Wide sand area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80, 48, 48]} />
        <meshStandardMaterial
          color={sandColor}
          roughness={0.95}
          metalness={0.0}
          bumpScale={0.04}
        />
      </mesh>

      {/* Court sand slightly raised */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[18, 9, 24, 12]} />
        <meshStandardMaterial color="#e8d59e" roughness={0.92} />
      </mesh>

      {/* Court boundary lines */}
      {[
        { pos: [0, 0.02, 4.5] as [number, number, number], size: [18.2, 0.03, 0.07] as [number, number, number] },
        { pos: [0, 0.02, -4.5] as [number, number, number], size: [18.2, 0.03, 0.07] as [number, number, number] },
        { pos: [9, 0.02, 0] as [number, number, number], size: [0.07, 0.03, 9] as [number, number, number] },
        { pos: [-9, 0.02, 0] as [number, number, number], size: [0.07, 0.03, 9] as [number, number, number] },
        { pos: [0, 0.02, 0] as [number, number, number], size: [0.07, 0.03, 9] as [number, number, number] },
      ].map((line, i) => (
        <mesh key={i} position={line.pos} castShadow receiveShadow>
          <boxGeometry args={line.size} />
          <meshStandardMaterial color="white" roughness={0.3} emissive="white" emissiveIntensity={0.15} />
        </mesh>
      ))}

      {/* Net posts */}
      {[-5, 5].map((z) => (
        <group key={z}>
          <mesh position={[0, 1.3, z]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 2.6, 12]} />
            <meshStandardMaterial color="#d4d4d4" roughness={0.3} metalness={0.7} />
          </mesh>
          {/* base plate */}
          <mesh position={[0, 0.04, z]}>
            <boxGeometry args={[0.4, 0.08, 0.4]} />
            <meshStandardMaterial color="#888" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* antenna */}
          <mesh position={[0, 2.85, z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
            <meshStandardMaterial color="#cc0000" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Net mesh — horizontal cords */}
      {Array.from({ length: NET_ROWS + 1 }, (_, row) => (
        <mesh key={`h${row}`} position={[0, 1.0 + row * (1.2 / NET_ROWS), 0]} castShadow>
          <boxGeometry args={[0.015, 0.012, 10]} />
          <meshStandardMaterial color="#c8c8c8" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Net mesh — vertical cords */}
      {Array.from({ length: NET_SEGMENTS + 1 }, (_, seg) => (
        <mesh key={`v${seg}`} position={[0, 1.6, -5 + (seg / NET_SEGMENTS) * 10]} castShadow>
          <boxGeometry args={[0.015, 1.2, 0.01]} />
          <meshStandardMaterial color="#c8c8c8" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* Net top white band */}
      <mesh position={[0, 2.28, 0]}>
        <boxGeometry args={[0.015, 0.1, 10.1]} />
        <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} roughness={0.4} />
      </mesh>
      {/* Net cable */}
      <mesh position={[0, 2.33, 0]}>
        <boxGeometry args={[0.03, 0.025, 10.2]} />
        <meshStandardMaterial color="#aaa" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ── Sun + Lighting ───────────────────────────────────────────────────────────
function SunLighting({ azimuth, elevation, intensity }: { azimuth: number; elevation: number; intensity: number }) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);

  const sunPos = useMemo(() => {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * 60,
      Math.cos(phi) * 60,
      Math.sin(phi) * Math.sin(theta) * 60
    );
  }, [azimuth, elevation]);

  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.shadow.mapSize.set(4096, 4096);
      lightRef.current.shadow.camera.near = 0.1;
      lightRef.current.shadow.camera.far = 200;
      lightRef.current.shadow.camera.left = -25;
      lightRef.current.shadow.camera.right = 25;
      lightRef.current.shadow.camera.top = 25;
      lightRef.current.shadow.camera.bottom = -25;
      lightRef.current.shadow.bias = -0.0003;
      lightRef.current.shadow.camera.updateProjectionMatrix();
    }
  }, []);

  return (
    <>
      {/* Main directional sun */}
      <directionalLight
        ref={lightRef}
        position={sunPos}
        intensity={intensity}
        castShadow
        color="#fff9e6"
      />
      {/* Sky hemisphere: warm sky / cool ground bounce */}
      <hemisphereLight args={["#87ceeb", "#c8a96e", 0.45]} />
      {/* Soft fill from opposite side */}
      <directionalLight
        position={[-sunPos.x * 0.3, sunPos.y * 0.5, -sunPos.z * 0.3]}
        intensity={intensity * 0.12}
        color="#b0cfe8"
      />
      {/* Rim light to make players pop */}
      <directionalLight position={[0, 4, -18]} intensity={0.3} color="#ffe0a0" />

      {/* Sun sphere in sky */}
      <mesh position={sunPos.clone().multiplyScalar(0.9)}>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#fffde8" />
      </mesh>
    </>
  );
}

// ── Physics Simulation Hook ──────────────────────────────────────────────────
function useVolleyballPhysics(paused: boolean) {
  const ballRef = useRef<BallPhysics>({
    pos: new THREE.Vector3(-5, 4, 0.5),
    vel: new THREE.Vector3(7, 5, 0.2),
    angVel: new THREE.Vector3(0.8, 3, 1.2),
    onGround: false,
    bounceCount: 0,
    lastHitter: "away",
    inPlay: true,
  });

  const homePlayers = useRef<PlayerState[]>([
    {
      pos: new THREE.Vector3(-4, 0, -2),
      vel: new THREE.Vector3(0, 0, 0),
      jumpT: 0,
      hitT: 0,
      isJumping: false,
      facingAngle: 0,
    },
    {
      pos: new THREE.Vector3(-6.5, 0, 1.5),
      vel: new THREE.Vector3(0, 0, 0),
      jumpT: 0,
      hitT: 0,
      isJumping: false,
      facingAngle: 0,
    },
  ]);

  const awayPlayers = useRef<PlayerState[]>([
    {
      pos: new THREE.Vector3(4, 0, 2),
      vel: new THREE.Vector3(0, 0, 0),
      jumpT: 0,
      hitT: 0,
      isJumping: false,
      facingAngle: 0,
    },
    {
      pos: new THREE.Vector3(6.5, 0, -1.5),
      vel: new THREE.Vector3(0, 0, 0),
      jumpT: 0,
      hitT: 0,
      isJumping: false,
      facingAngle: 0,
    },
  ]);

  const resetBall = useCallback(() => {
    const b = ballRef.current;
    b.pos.set(-5, 4.5, (Math.random() - 0.5) * 3);
    b.vel.set(8 + Math.random() * 2, 5 + Math.random() * 2, (Math.random() - 0.5) * 1.5);
    b.angVel.set(
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 6
    );
    b.bounceCount = 0;
    b.lastHitter = "away";
    b.inPlay = true;
  }, []);

  const _tmpVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (paused) return;
    const clampedDt = Math.min(dt, 0.033); // cap at 30fps physics
    const b = ballRef.current;

    // ── gravity + drag ──
    b.vel.y += GRAVITY * clampedDt;
    b.vel.multiplyScalar(Math.pow(DRAG, clampedDt * 60));
    b.angVel.multiplyScalar(Math.pow(0.98, clampedDt * 60));

    // ── integrate position ──
    b.pos.addScaledVector(b.vel, clampedDt);

    // ── floor bounce ──
    if (b.pos.y - BALL_RADIUS <= 0) {
      b.pos.y = BALL_RADIUS;
      b.vel.y = -b.vel.y * RESTITUTION;
      b.vel.x *= 0.82;
      b.vel.z *= 0.82;
      b.bounceCount++;
      b.onGround = Math.abs(b.vel.y) < 0.5;

      // reset after 2 bounces in-bounds or 1 out-of-bounds
      const outX = Math.abs(b.pos.x) > COURT_HALF_X;
      const outZ = Math.abs(b.pos.z) > COURT_HALF_Z;
      if (b.bounceCount >= 2 || (outX || outZ)) {
        setTimeout(resetBall, 1200);
        b.inPlay = false;
      }
    }

    // ── net collision ──
    if (Math.abs(b.pos.x) < 0.25 && b.pos.y < NET_HEIGHT + BALL_RADIUS) {
      b.vel.x = -b.vel.x * 0.6;
      b.pos.x += b.vel.x > 0 ? 0.3 : -0.3;
    }

    // ── side walls (keep ball in play area roughly) ──
    if (Math.abs(b.pos.z) > 6) {
      b.vel.z = -b.vel.z * 0.7;
      b.pos.z = Math.sign(b.pos.z) * 6;
    }

    // ── Player AI ──────────────────────────────────────────────────────────
    const allPlayers = [
      ...homePlayers.current.map(p => ({ p, side: "home" as const })),
      ...awayPlayers.current.map(p => ({ p, side: "away" as const })),
    ];

    for (const { p, side } of allPlayers) {
      // Only the side where ball currently is chases it
      const ballOnMySide = side === "home" ? b.pos.x < 0 : b.pos.x > 0;
      const isLastHitter = b.lastHitter === side;

      let targetX: number;
      let targetZ: number;

      if (ballOnMySide && !isLastHitter) {
        // predict where ball lands
        const tToHit = estimateTimeToReach(b, PLAYER_REACH);
        targetX = Math.max(-COURT_HALF_X + 1, Math.min(COURT_HALF_X - 1,
          b.pos.x + b.vel.x * tToHit));
        targetZ = Math.max(-COURT_HALF_Z + 0.5, Math.min(COURT_HALF_Z - 0.5,
          b.pos.z + b.vel.z * tToHit));
      } else {
        // return to base
        const isP1 = side === "home" ? homePlayers.current[0] === p : awayPlayers.current[0] === p;
        targetX = side === "home" ? (isP1 ? -4 : -6.5) : (isP1 ? 4 : 6.5);
        targetZ = isP1 ? -2 : 1.5;
      }

      // Move player
      _tmpVec.set(targetX - p.pos.x, 0, targetZ - p.pos.z);
      const distToTarget = _tmpVec.length();
      if (distToTarget > 0.15) {
        _tmpVec.normalize();
        p.vel.lerp(_tmpVec.multiplyScalar(PLAYER_SPEED), 10 * clampedDt);
        p.facingAngle = Math.atan2(p.vel.x, p.vel.z);
      } else {
        p.vel.multiplyScalar(0.1);
      }
      p.pos.addScaledVector(p.vel, clampedDt);

      // Clamp player to their half
      p.pos.x = side === "home"
        ? Math.max(-COURT_HALF_X + 0.5, Math.min(-0.6, p.pos.x))
        : Math.max(0.6, Math.min(COURT_HALF_X - 0.5, p.pos.x));
      p.pos.z = Math.max(-COURT_HALF_Z + 0.3, Math.min(COURT_HALF_Z - 0.3, p.pos.z));

      // ── Hit detection ──
      const dx = p.pos.x - b.pos.x;
      const dy = (p.pos.y + PLAYER_REACH * 0.75) - b.pos.y;
      const dz = p.pos.z - b.pos.z;
      const distToBall = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (ballOnMySide && distToBall < HIT_RANGE && !isLastHitter && b.inPlay) {
        // Spike / set / serve — redirect ball to opposite side with variability
        const targetZOut = (Math.random() - 0.5) * 6;
        const dirX = side === "home" ? 1 : -1;
        const speed = 11 + Math.random() * 4;
        const vx = dirX * speed * 0.82;
        const vy = 5.5 + Math.random() * 2;
        const vz = (targetZOut - b.pos.z) * 0.55;
        b.vel.set(vx, vy, vz);
        b.angVel.set(
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 8
        );
        b.lastHitter = side;

        // Trigger hit animation
        p.hitT = 0.01;
        p.jumpT = 0.01;
      }

      // Animate hit / jump
      if (p.hitT > 0) {
        p.hitT = Math.min(1, p.hitT + clampedDt * 2.8);
        if (p.hitT >= 1) p.hitT = 0;
      }
      if (p.jumpT > 0) {
        p.jumpT = Math.min(1, p.jumpT + clampedDt * 2.2);
        p.pos.y = Math.sin(p.jumpT * Math.PI) * 0.55;
        if (p.jumpT >= 1) { p.jumpT = 0; p.pos.y = 0; }
      }
    }
  });

  return { ballRef, homePlayers, awayPlayers, resetBall };
}

function estimateTimeToReach(b: BallPhysics, targetHeight: number): number {
  // simple quadratic solve for when ball.y = targetHeight
  const a = 0.5 * GRAVITY;
  const bCoef = b.vel.y;
  const c = b.pos.y - targetHeight;
  const disc = bCoef * bCoef - 4 * a * c;
  if (disc < 0) return 0.3;
  const t1 = (-bCoef + Math.sqrt(disc)) / (2 * a);
  const t2 = (-bCoef - Math.sqrt(disc)) / (2 * a);
  const candidates = [t1, t2].filter(t => t > 0.05);
  return candidates.length > 0 ? Math.min(...candidates) : 0.3;
}

// ── Pixel Ratio Setter ───────────────────────────────────────────────────────
function PixelRatioSetter() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }, [gl]);
  return null;
}

// ── Score Display ─────────────────────────────────────────────────────────────
function ScoreBoard({ score }: { score: [number, number] }) {
  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20">
      <div className="bg-[#0077B6]/90 backdrop-blur px-6 py-3 text-white">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">HOME</div>
        <div className="text-4xl font-black tabular-nums">{score[0]}</div>
      </div>
      <div className="bg-black/70 backdrop-blur px-4 py-3 text-white/60">
        <div className="text-xl font-black">:</div>
      </div>
      <div className="bg-[#E76F51]/90 backdrop-blur px-6 py-3 text-white">
        <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">AWAY</div>
        <div className="text-4xl font-black tabular-nums">{score[1]}</div>
      </div>
    </div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ paused }: { paused: boolean }) {
  const { ballRef, homePlayers, awayPlayers } = useVolleyballPhysics(paused);

  const sandColor = "#dfc97a";

  return (
    <>
      <PixelRatioSetter />

      <PerspectiveCamera makeDefault position={[18, 11, 18]} fov={52} />
      <OrbitControls
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={45}
        target={[0, 1, 0]}
        enableDamping
        dampingFactor={0.06}
      />

      {/* Sky */}
      <Sky
        sunPosition={[80, 22, 50]}
        turbidity={3.5}
        rayleigh={0.5}
        mieCoefficient={0.004}
        mieDirectionalG={0.87}
        inclination={0.495}
        azimuth={0.25}
      />

      {/* Lighting */}
      <SunLighting azimuth={135} elevation={42} intensity={3.8} />

      {/* Environment for reflections */}
      <Environment preset="sunset" backgroundIntensity={0} />

      {/* Sparkles near water side (ambient atmosphere) */}
      <Sparkles count={60} scale={[30, 4, 30]} size={0.8} speed={0.1} opacity={0.18} color="#fff9c4" />

      <BeachCourt sandColor={sandColor} />

      <Ball physRef={ballRef} />
      <BallShadowRing ballPos={ballRef.current.pos} />

      {/* Home players (blue) */}
      <Player state={homePlayers.current[0]} teamColor="#0077B6" accentColor="#00b4d8" number="7" side="home" />
      <Player state={homePlayers.current[1]} teamColor="#0077B6" accentColor="#00b4d8" number="11" side="home" />

      {/* Away players (orange) */}
      <Player state={awayPlayers.current[0]} teamColor="#E76F51" accentColor="#f4a261" number="4" side="away" />
      <Player state={awayPlayers.current[1]} teamColor="#E76F51" accentColor="#f4a261" number="9" side="away" />

      {/* Post-processing */}
      <EffectComposer>
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.78}
          luminanceSmoothing={0.08}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.1} darkness={0.35} />
      </EffectComposer>
    </>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────────
export default function ThreeDCourt() {
  const { data: locations } = useListLocations();
  const { data: roster } = useGetTeamRoster();
  const [selectedLocId, setSelectedLocId] = useState<string>("");
  const [paused, setPaused] = useState(false);
  const [score] = useState<[number, number]>([2, 1]);
  const [key, setKey] = useState(0);

  const selectedLocation = useMemo(
    () => locations?.find(l => l.id.toString() === selectedLocId) || locations?.[0],
    [locations, selectedLocId]
  );

  const activePlayers = roster?.activePlayers ?? [];

  return (
    <div className="h-[calc(100vh-11rem)] w-full rounded-3xl overflow-hidden relative border border-primary/20 shadow-2xl">
      <Canvas
        key={key}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <Scene paused={paused} />
      </Canvas>

      {/* Score */}
      <ScoreBoard score={score} />

      {/* Control bar bottom-center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="bg-background/80 backdrop-blur gap-2 h-9 border-white/20 shadow-xl"
          onClick={() => setPaused(p => !p)}
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-background/80 backdrop-blur gap-2 h-9 border-white/20 shadow-xl"
          onClick={() => setKey(k => k + 1)}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
        <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur rounded-full border border-white/20 shadow-xl text-xs font-bold text-primary">
          <Wind className="h-3.5 w-3.5 animate-pulse" />
          {selectedLocation ? `${selectedLocation.city} · ${selectedLocation.weatherPatterns}` : "LIVE MATCH VIEW"}
        </div>
      </div>

      {/* Sidebar */}
      <div className="absolute top-16 left-5 w-64 space-y-3">
        <Card className="bg-background/80 backdrop-blur border-white/20 shadow-xl">
          <CardHeader className="p-3 pb-1.5">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary" /> VENUE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <Select onValueChange={setSelectedLocId} value={selectedLocId || selectedLocation?.id.toString()}>
              <SelectTrigger className="bg-background/60 h-8 text-xs">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map(l => (
                  <SelectItem key={l.id} value={l.id.toString()} className="text-xs">
                    {l.city}, {l.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLocation && (
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <CloudSun className="h-2.5 w-2.5" /> {selectedLocation.weatherPatterns}
                </Badge>
                <Badge className="bg-secondary text-secondary-foreground text-[10px]">
                  {selectedLocation.courtType}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {activePlayers.length > 0 && (
          <Card className="bg-background/80 backdrop-blur border-white/20 shadow-xl">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-xs font-bold">ON COURT</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {activePlayers.slice(0, 4).map((p: { id: number; name: string; position: string }, i: number) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${i < 2 ? "bg-[#0077B6]" : "bg-[#E76F51]"}`} />
                    <span className="font-medium truncate max-w-[110px]">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {p.position.replace(/_/g, " ").slice(0, 3).toUpperCase()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
