import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Sky,
  PerspectiveCamera,
  Environment,
  Sparkles,
  Billboard,
  Text,
  Cloud,
  Clouds,
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
import { CloudSun, MapPin, Wind, Play, Pause, RotateCcw, RefreshCw } from "lucide-react";

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

type HitType = "spike" | "set" | "dig";
interface PlayerState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  jumpT: number;      // 0..1 jump animation progress
  hitT: number;       // 0..1 hit arm swing progress
  diveT: number;      // 0..1 dive/dig animation progress
  isJumping: boolean;
  facingAngle: number;
  hitType: HitType;
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

    groupRef.current.position.lerp(s.pos, 10 * dt);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, s.facingAngle, 13 * dt
    );

    const t   = s.hitT;
    const jt  = s.jumpT;
    const dvt = s.diveT;
    const isMoving = s.vel.length() > 0.4;
    const walkCycle = Date.now() / 340;

    // ── DIVE — body pitches forward, both arms platform out ──
    if (dvt > 0) {
      const arc = Math.sin(dvt * Math.PI);
      groupRef.current.rotation.x = arc * 1.08;
      if (armLRef.current) { armLRef.current.rotation.x = -arc * 1.15; armLRef.current.rotation.z = arc * 0.25; }
      if (armRRef.current) { armRRef.current.rotation.x = -arc * 1.15; armRRef.current.rotation.z = -arc * 0.25; }
      if (legLRef.current) { legLRef.current.rotation.x = -arc * 0.3; }
      if (legRRef.current) { legRRef.current.rotation.x =  arc * 0.2; }
      if (torsoRef.current) torsoRef.current.scale.y = 1 - arc * 0.12;
    } else {
      // smoothly upright
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, 10 * dt);

      // ── SPIKE — jump + overhead smash ──
      if (jt > 0 && s.hitType === "spike") {
        const arc  = Math.sin(jt * Math.PI);
        const smash = jt > 0.38 ? Math.sin(((jt - 0.38) / 0.62) * Math.PI) : 0;
        if (torsoRef.current) torsoRef.current.scale.y = 1 + 0.24 * arc;
        if (armRRef.current) {
          armRRef.current.rotation.x = jt < 0.42
            ? -arc * 0.7                   // wind-up: arm pulls back/up
            : -Math.PI * 1.45 * smash;     // smash: drives hard forward-down
          armRRef.current.rotation.z = 0.22 * (1 - arc);
        }
        if (armLRef.current) { armLRef.current.rotation.x = arc * 0.55; armLRef.current.rotation.z = 0; }
        if (legLRef.current) legLRef.current.rotation.x =  arc * 0.22;
        if (legRRef.current) legRRef.current.rotation.x =  arc * 0.22;

      // ── SET / DIG arm swing ──
      } else if (t > 0) {
        const arc = Math.sin(t * Math.PI);
        const isSpikeHit = s.hitType === "spike";
        if (armRRef.current) {
          armRRef.current.rotation.x = isSpikeHit ? -arc * Math.PI * 1.2 : -arc * Math.PI * 0.9;
          armRRef.current.rotation.z = 0;
        }
        if (armLRef.current) {
          armLRef.current.rotation.x = -arc * Math.PI * 0.5;
          armLRef.current.rotation.z = 0;
        }
        if (jt > 0) {
          const ja = Math.sin(jt * Math.PI);
          if (torsoRef.current) torsoRef.current.scale.y = 1 + 0.16 * ja;
          if (legLRef.current) legLRef.current.rotation.x = ja * 0.18;
          if (legRRef.current) legRRef.current.rotation.x = ja * 0.18;
        }

      // ── JUMP (generic / approach) ──
      } else if (jt > 0) {
        const arc = Math.sin(jt * Math.PI);
        if (torsoRef.current) torsoRef.current.scale.y = 1 + 0.15 * arc;
        if (legLRef.current) legLRef.current.rotation.x =  arc * 0.2;
        if (legRRef.current) legRRef.current.rotation.x =  arc * 0.2;
        if (armLRef.current) armLRef.current.rotation.x = -arc * 0.3;
        if (armRRef.current) armRRef.current.rotation.x = -arc * 0.3;

      // ── WALK — sand-heavy stride ──
      } else if (isMoving) {
        if (torsoRef.current) torsoRef.current.scale.y = 1;
        if (legLRef.current) { legLRef.current.rotation.x =  Math.sin(walkCycle) * 0.52; }
        if (legRRef.current) { legRRef.current.rotation.x = -Math.sin(walkCycle) * 0.52; }
        if (armLRef.current) { armLRef.current.rotation.x = -Math.sin(walkCycle) * 0.34; armLRef.current.rotation.z = 0; }
        if (armRRef.current) { armRRef.current.rotation.x =  Math.sin(walkCycle) * 0.34; armRRef.current.rotation.z = 0; }

      // ── IDLE — gentle sway, ready stance ──
      } else {
        if (torsoRef.current) torsoRef.current.scale.y = 1;
        const sway = Math.sin(Date.now() / 950) * 0.05;
        if (armLRef.current) { armLRef.current.rotation.x = sway + 0.15; armLRef.current.rotation.z = 0.08; }
        if (armRRef.current) { armRRef.current.rotation.x = -sway + 0.15; armRRef.current.rotation.z = -0.08; }
        if (legLRef.current) legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, 0, 8 * dt);
        if (legRRef.current) legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, 0, 8 * dt);
      }
    }

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
          <Text fontSize={0.22} color="white" outlineWidth={0.02} outlineColor="#000000" outlineOpacity={0.5}>
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

// ── Procedural sand texture ───────────────────────────────────────────────────
function useSandTexture(size = 512) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // base sand colour
    ctx.fillStyle = "#d4b97a";
    ctx.fillRect(0, 0, size, size);

    // grain: many tiny ellipses at random angles
    const grainCount = 18000;
    for (let i = 0; i < grainCount; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 1.5 + Math.random() * 3.5;
      const w = 0.4 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI;
      const brightness = 0.72 + Math.random() * 0.36;
      const alpha = 0.3 + Math.random() * 0.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, w, 0, 0, Math.PI * 2);
      const r = Math.round(brightness * 210);
      const g = Math.round(brightness * 175);
      const b = Math.round(brightness * 110);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      ctx.restore();
    }

    // subtle ripple lines
    for (let row = 0; row < 24; row++) {
      const y = (row / 24) * size + Math.random() * 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 12) {
        ctx.lineTo(x, y + Math.sin(x / 18 + row) * 1.8);
      }
      ctx.strokeStyle = `rgba(160,120,60,0.06)`;
      ctx.lineWidth = 0.6 + Math.random() * 0.8;
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.anisotropy = 16;
    return tex;
  }, [size]);
}

// ── Detailed Beach Court ─────────────────────────────────────────────────────
function BeachCourt({ sandColor }: { sandColor: string }) {
  const NET_SEGMENTS = 18;
  const NET_ROWS = 6;
  const sandTex = useSandTexture(512);
  const courtTex = useSandTexture(256);

  return (
    <group>
      {/* Wide sand area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80, 48, 48]} />
        <meshStandardMaterial
          map={sandTex}
          color={sandColor}
          roughness={0.97}
          metalness={0.0}
        />
      </mesh>

      {/* Court sand slightly raised */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[18, 9, 24, 12]} />
        <meshStandardMaterial map={courtTex} color="#ddc888" roughness={0.94} />
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

// ── Sponsor Boards ────────────────────────────────────────────────────────────
const SPONSORS = [
  { name: "BEACH PRO",  color: "#0077B6", accent: "#fff" },
  { name: "SAND QUEEN", color: "#E76F51", accent: "#fff" },
  { name: "VOLLEY FIT", color: "#2d6a4f", accent: "#fff" },
  { name: "SUN SPORT",  color: "#e9c46a", accent: "#1a1a1a" },
  { name: "WAVE RIDER", color: "#4cc9f0", accent: "#1a1a1a" },
  { name: "CORAL GEAR", color: "#c1121f", accent: "#fff" },
];

function SponsorBoard({
  position,
  rotation,
  sponsorIdx,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  sponsorIdx: number;
}) {
  const s = SPONSORS[sponsorIdx % SPONSORS.length];
  return (
    <group position={position} rotation={rotation}>
      {/* Post left */}
      <mesh position={[-1.45, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.0, 8]} />
        <meshStandardMaterial color="#999" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Post right */}
      <mesh position={[1.45, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 2.0, 8]} />
        <meshStandardMaterial color="#999" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Board background */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.8, 0.9, 0.06]} />
        <meshStandardMaterial color={s.color} roughness={0.5} metalness={0.05} />
      </mesh>
      {/* White trim top & bottom */}
      <mesh position={[0, 0.465, 0.035]}>
        <boxGeometry args={[2.82, 0.06, 0.01]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, -0.465, 0.035]}>
        <boxGeometry args={[2.82, 0.06, 0.01]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Sponsor name */}
      <Text
        position={[0, 0, 0.07]}
        fontSize={0.26}
        font={undefined}
        color={s.accent}
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.08}
        maxWidth={2.6}
      >
        {s.name}
      </Text>
    </group>
  );
}

function SponsorBoards() {
  const BOARD_H = 0.8; // centre height above ground
  // sideline boards: along z = ±7, spaced across x
  const sideX = [-7, -3.5, 0, 3.5, 7];
  // end line boards: along x = ±10.8, two per end
  const endZ = [-2.5, 2.5];
  return (
    <group>
      {/* Front sideline (z = -7, face toward +z) */}
      {sideX.map((x, i) => (
        <SponsorBoard
          key={`fs${i}`}
          position={[x, BOARD_H, -7]}
          rotation={[0, 0, 0]}
          sponsorIdx={i}
        />
      ))}
      {/* Back sideline (z = 7, face toward -z) */}
      {sideX.map((x, i) => (
        <SponsorBoard
          key={`bs${i}`}
          position={[x, BOARD_H, 7]}
          rotation={[0, Math.PI, 0]}
          sponsorIdx={i + 2}
        />
      ))}
      {/* Left end (x = -11, face toward +x) */}
      {endZ.map((z, i) => (
        <SponsorBoard
          key={`le${i}`}
          position={[-11, BOARD_H, z]}
          rotation={[0, Math.PI / 2, 0]}
          sponsorIdx={i + 1}
        />
      ))}
      {/* Right end (x = 11, face toward -x) */}
      {endZ.map((z, i) => (
        <SponsorBoard
          key={`re${i}`}
          position={[11, BOARD_H, z]}
          rotation={[0, -Math.PI / 2, 0]}
          sponsorIdx={i + 4}
        />
      ))}
    </group>
  );
}

// ── Umpire Chair ──────────────────────────────────────────────────────────────
function UmpireChair() {
  // Positioned beside the right net post (z = -5.8), facing the court
  const SEAT_H = 2.55;
  const skinColor = "#f4c08a";
  return (
    <group position={[0, 0, -6.6]} rotation={[0, 0, 0]}>
      {/* Four legs */}
      {[[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, SEAT_H / 2, lz]} castShadow>
          <boxGeometry args={[0.06, SEAT_H, 0.06]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      {/* Cross braces */}
      {[0.7, 1.5].map((yBrace, i) => (
        <group key={i}>
          <mesh position={[0, yBrace, -0.32]}>
            <boxGeometry args={[0.7, 0.04, 0.04]} />
            <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, yBrace, 0.32]}>
            <boxGeometry args={[0.7, 0.04, 0.04]} />
            <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[-0.32, yBrace, 0]}>
            <boxGeometry args={[0.04, 0.04, 0.7]} />
            <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.32, yBrace, 0]}>
            <boxGeometry args={[0.04, 0.04, 0.7]} />
            <meshStandardMaterial color="#aaa" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* Seat platform */}
      <mesh position={[0, SEAT_H + 0.06, 0]} castShadow>
        <boxGeometry args={[0.72, 0.1, 0.72]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      {/* Seat cushion */}
      <mesh position={[0, SEAT_H + 0.14, 0]}>
        <boxGeometry args={[0.62, 0.06, 0.62]} />
        <meshStandardMaterial color="#0077B6" roughness={0.8} />
      </mesh>
      {/* Back rest */}
      <mesh position={[0, SEAT_H + 0.56, -0.34]}>
        <boxGeometry args={[0.66, 0.82, 0.06]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.5} />
      </mesh>
      {/* Armrests */}
      {[-0.34, 0.34].map((ax, i) => (
        <mesh key={i} position={[ax, SEAT_H + 0.38, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.62]} />
          <meshStandardMaterial color="#bbb" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* Footrest */}
      <mesh position={[0, 1.85, 0.32]}>
        <boxGeometry args={[0.64, 0.05, 0.2]} />
        <meshStandardMaterial color="#ccc" roughness={0.5} />
      </mesh>
      {/* Canopy frame */}
      {[[-0.34, 0.34], [0.34, 0.34], [-0.34, -0.34], [0.34, -0.34]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, SEAT_H + 1.32, cz]}>
          <boxGeometry args={[0.04, 0.82, 0.04]} />
          <meshStandardMaterial color="#999" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      {/* Canopy roof */}
      <mesh position={[0, SEAT_H + 1.76, 0]}>
        <boxGeometry args={[0.96, 0.04, 0.96]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.6} />
      </mesh>
      {/* Canopy overhang front */}
      <mesh position={[0, SEAT_H + 1.73, 0.52]}>
        <boxGeometry args={[0.96, 0.03, 0.08]} />
        <meshStandardMaterial color="#d4a017" roughness={0.6} />
      </mesh>

      {/* ── Umpire figure (seated) ── */}
      {/* Torso */}
      <mesh position={[0, SEAT_H + 0.54, -0.1]} castShadow>
        <capsuleGeometry args={[0.15, 0.42, 4, 8]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, SEAT_H + 0.98, -0.08]} castShadow>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, SEAT_H + 1.1, -0.06]}>
        <cylinderGeometry args={[0.15, 0.16, 0.1, 16]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.7} />
      </mesh>
      {/* Cap brim */}
      <mesh position={[0, SEAT_H + 1.05, 0.1]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.32, 0.025, 0.14]} />
        <meshStandardMaterial color="#1a3a5c" roughness={0.7} />
      </mesh>
      {/* Arms on armrest */}
      {[-0.28, 0.28].map((ax, i) => (
        <mesh key={i} position={[ax, SEAT_H + 0.38, 0.1]} rotation={[0.5, 0, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.3, 4, 6]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
      ))}
      {/* Legs (bent) */}
      {[-0.14, 0.14].map((lx, i) => (
        <mesh key={i} position={[lx, SEAT_H + 0.14, 0.22]} rotation={[0.8, 0, 0]} castShadow>
          <capsuleGeometry args={[0.075, 0.45, 4, 8]} />
          <meshStandardMaterial color="#1a3a5c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── Spectator Stand ───────────────────────────────────────────────────────────
const SPECTATOR_COLORS = [
  "#e76f51","#2a9d8f","#e9c46a","#264653","#f4a261",
  "#a8dadc","#e63946","#457b9d","#f1faee","#d62828",
];

function SimpleSpectator({ position, colorIdx }: { position: [number, number, number]; colorIdx: number }) {
  const skinColor = "#e8c9a0";
  const jerseyColor = SPECTATOR_COLORS[colorIdx % SPECTATOR_COLORS.length];
  return (
    <group position={position}>
      {/* Torso */}
      <mesh position={[0, 0.30, 0]}>
        <capsuleGeometry args={[0.148, 0.36, 4, 6]} />
        <meshStandardMaterial color={jerseyColor} roughness={0.8} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.22, 0.30, 0]} rotation={[0, 0, 0.38]}>
        <capsuleGeometry args={[0.055, 0.26, 4, 6]} />
        <meshStandardMaterial color={jerseyColor} roughness={0.8} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.22, 0.30, 0]} rotation={[0, 0, -0.38]}>
        <capsuleGeometry args={[0.055, 0.26, 4, 6]} />
        <meshStandardMaterial color={jerseyColor} roughness={0.8} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.138, 10, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
    </group>
  );
}

function SpectatorStand() {
  const ROWS = 4;
  const SEATS_PER_ROW = 14;
  const ROW_DEPTH = 0.75;
  const ROW_RISE = 0.55;
  const STAND_WIDTH = SEATS_PER_ROW * 0.85;
  const BASE_Z = 8.5; // starts just beyond the sideline
  const BASE_X = -STAND_WIDTH / 2;

  return (
    <group>
      {/* Concrete base block */}
      <mesh position={[0, -0.25, BASE_Z + (ROWS * ROW_DEPTH) / 2]} receiveShadow castShadow>
        <boxGeometry args={[STAND_WIDTH + 1, 0.5, ROWS * ROW_DEPTH + 1]} />
        <meshStandardMaterial color="#c8c2b8" roughness={0.9} />
      </mesh>

      {/* Tiered rows */}
      {Array.from({ length: ROWS }, (_, row) => {
        const zRow = BASE_Z + row * ROW_DEPTH;
        const yRow = row * ROW_RISE;
        return (
          <group key={row}>
            {/* Step riser */}
            <mesh position={[0, yRow - ROW_RISE / 2 + 0.01, zRow]} receiveShadow castShadow>
              <boxGeometry args={[STAND_WIDTH, ROW_RISE, 0.08]} />
              <meshStandardMaterial color="#b0a898" roughness={0.9} />
            </mesh>
            {/* Step tread */}
            <mesh position={[0, yRow + 0.04, zRow + ROW_DEPTH / 2]} receiveShadow>
              <boxGeometry args={[STAND_WIDTH, 0.08, ROW_DEPTH]} />
              <meshStandardMaterial color="#c8c2b8" roughness={0.9} />
            </mesh>
            {/* Seat backs */}
            <mesh position={[0, yRow + 0.4, zRow + 0.1]}>
              <boxGeometry args={[STAND_WIDTH, 0.5, 0.06]} />
              <meshStandardMaterial color="#0077B6" roughness={0.7} />
            </mesh>

            {/* Spectators */}
            {Array.from({ length: SEATS_PER_ROW }, (_, col) => {
              const sx = BASE_X + col * 0.85 + 0.42 as number;
              return (
                <SimpleSpectator
                  key={col}
                  position={[sx, yRow + 0.35, zRow + 0.25]}
                  colorIdx={row * SEATS_PER_ROW + col}
                />
              );
            })}
          </group>
        );
      })}

      {/* Canopy roof */}
      {/* Back support columns */}
      {[-STAND_WIDTH / 2 + 0.4, 0, STAND_WIDTH / 2 - 0.4].map((cx, i) => (
        <mesh key={i} position={[cx, ROWS * ROW_RISE + 1.6, BASE_Z + ROWS * ROW_DEPTH - 0.4]} castShadow>
          <boxGeometry args={[0.18, ROWS * ROW_RISE + 3.2, 0.18]} />
          <meshStandardMaterial color="#888" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Front support columns */}
      {[-STAND_WIDTH / 2 + 0.4, 0, STAND_WIDTH / 2 - 0.4].map((cx, i) => (
        <mesh key={i} position={[cx, 1.6, BASE_Z - 0.3]} castShadow>
          <boxGeometry args={[0.14, 3.2, 0.14]} />
          <meshStandardMaterial color="#888" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Roof panel */}
      <mesh
        position={[0, ROWS * ROW_RISE + 3.25, BASE_Z + (ROWS * ROW_DEPTH) / 2 + 0.6]}
        rotation={[-0.12, 0, 0]}
        castShadow
      >
        <boxGeometry args={[STAND_WIDTH + 1.2, 0.08, ROWS * ROW_DEPTH + 2.0]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Roof underside shadow trim */}
      <mesh position={[0, ROWS * ROW_RISE + 3.22, BASE_Z - 0.5]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[STAND_WIDTH + 1.2, 0.04, 0.18]} />
        <meshStandardMaterial color="#c8a800" roughness={0.6} />
      </mesh>

      {/* Fence / barrier at front of stand */}
      <mesh position={[0, 0.55, BASE_Z - 0.35]}>
        <boxGeometry args={[STAND_WIDTH, 1.0, 0.06]} />
        <meshStandardMaterial color="#e0dbd0" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ── Animated Ocean ────────────────────────────────────────────────────────────
// Gerstner wave params: [dirX, dirZ, amplitude, wavenumber, speed]
const GERSTNER_WAVES: [number, number, number, number, number][] = [
  [ 1.0,  0.0,  0.62, 0.14, 1.25],
  [ 0.7,  0.7,  0.38, 0.21, 0.95],
  [-0.5,  0.86, 0.28, 0.29, 1.55],
  [ 0.3, -0.95, 0.18, 0.38, 0.72],
  [ 0.9,  0.4,  0.14, 0.17, 2.05],
  [-0.8,  0.6,  0.10, 0.45, 1.80],
];

function Ocean() {
  const geoRef   = useRef<THREE.PlaneGeometry>(null!);
  const foamRef  = useRef<THREE.PlaneGeometry>(null!);
  const shallowRef = useRef<THREE.PlaneGeometry>(null!);
  // Cache original rest positions so waves compute from the undeformed mesh
  const origDeep    = useRef<Float32Array | null>(null);
  const origShallow = useRef<Float32Array | null>(null);

  const W_SEGS   = 72;
  const D_SEGS   = 48;
  const FOAM_SEGS = 40;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // ── Gerstner deep ocean ──
    const geo = geoRef.current;
    if (geo) {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      if (!origDeep.current) {
        origDeep.current = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          origDeep.current[i * 2]     = pos.getX(i);
          origDeep.current[i * 2 + 1] = pos.getZ(i);
        }
      }
      for (let i = 0; i < pos.count; i++) {
        const ox = origDeep.current[i * 2];
        const oz = origDeep.current[i * 2 + 1];
        let y = 0;
        for (const [dx, dz, A, k, spd] of GERSTNER_WAVES) {
          const phase = k * (ox * dx + oz * dz) - spd * t;
          // Gerstner: squared cosine gives sharp crests, flat troughs
          y += A * (Math.pow((Math.cos(phase) + 1) * 0.5, 1.8) * 2 - 0.9);
          // High-freq chop
          y += A * 0.18 * Math.sin(phase * 2.1 + ox * 0.07 - oz * 0.05);
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // ── Shallow ripples (physics-lite) ──
    const sg = shallowRef.current;
    if (sg) {
      const pos = sg.attributes.position as THREE.BufferAttribute;
      if (!origShallow.current) {
        origShallow.current = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
          origShallow.current[i * 2]     = pos.getX(i);
          origShallow.current[i * 2 + 1] = pos.getZ(i);
        }
      }
      for (let i = 0; i < pos.count; i++) {
        const ox = origShallow.current[i * 2];
        const oz = origShallow.current[i * 2 + 1];
        const y =
          Math.sin(ox * 0.38 + t * 1.7) * 0.14 +
          Math.sin(oz * 0.52 + t * 1.3) * 0.09 +
          Math.sin(ox * 0.72 - oz * 0.31 + t * 2.2) * 0.05;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      sg.computeVertexNormals();
    }

    // ── Foam — pulses in toward shore ──
    const fg = foamRef.current;
    if (fg) {
      const pos = fg.attributes.position as THREE.BufferAttribute;
      const surge = Math.sin(t * 0.55) * 0.5; // shore-surge offset
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setY(i, Math.sin(x * 0.38 + t * 1.9) * 0.09 + 0.03);
        pos.setZ(i, surge);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Wet sand shoreline strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 13.5]} receiveShadow>
        <planeGeometry args={[80, 3.5]} />
        <meshStandardMaterial color="#c8a85a" roughness={0.82} metalness={0.08} />
      </mesh>
      {/* Very wet sand — dark strip right at waterline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 15.6]}>
        <planeGeometry args={[80, 1.6]} />
        <meshStandardMaterial color="#a8864a" roughness={0.7} metalness={0.12} />
      </mesh>

      {/* Shallow water (transparent, rippled) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 18]}>
        <planeGeometry ref={shallowRef} args={[80, 6, FOAM_SEGS, 16]} />
        <meshStandardMaterial
          color="#38b2c8"
          transparent
          opacity={0.55}
          roughness={0.05}
          metalness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rolling foam at waterline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 16.4]}>
        <planeGeometry ref={foamRef} args={[80, 0.5, FOAM_SEGS, 2]} />
        <meshStandardMaterial
          color="white"
          transparent
          opacity={0.65}
          roughness={0.9}
          emissive="white"
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Deep ocean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 33]}>
        <planeGeometry ref={geoRef} args={[100, 36, W_SEGS, D_SEGS]} />
        <meshStandardMaterial
          color="#0e6b8a"
          roughness={0.08}
          metalness={0.55}
          transparent
          opacity={0.92}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Distant ocean fill — flat, no waves */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 60]}>
        <planeGeometry args={[200, 50]} />
        <meshStandardMaterial color="#0a5070" roughness={0.15} metalness={0.5} />
      </mesh>

      {/* Horizon sky glow strip */}
      <mesh rotation={[0, 0, 0]} position={[0, 4, 82]}>
        <planeGeometry args={[200, 12]} />
        <meshStandardMaterial
          color="#a8d8ea"
          emissive="#6ab8d8"
          emissiveIntensity={0.25}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Seagulls ──────────────────────────────────────────────────────────────────
interface GullConfig { rx: number; rz: number; cy: number; spd: number; phase: number; sz: number }
const GULL_CONFIGS: GullConfig[] = [
  { rx: 20, rz: 10, cy: 11, spd: 0.38, phase: 0,            sz: 0.52 },
  { rx: 28, rz: 13, cy: 15, spd: 0.27, phase: Math.PI*0.7,  sz: 0.65 },
  { rx: 15, rz:  8, cy:  9, spd: 0.52, phase: Math.PI*1.4,  sz: 0.44 },
  { rx: 34, rz: 16, cy: 19, spd: 0.22, phase: Math.PI*0.3,  sz: 0.72 },
  { rx: 22, rz: 11, cy: 13, spd: 0.44, phase: Math.PI*1.9,  sz: 0.48 },
  { rx: 12, rz:  6, cy:  7, spd: 0.60, phase: Math.PI*1.1,  sz: 0.38 },
  { rx: 40, rz: 18, cy: 22, spd: 0.18, phase: Math.PI*0.55, sz: 0.80 },
];

function Seagull({ rx, rz, cy, spd, phase, sz }: GullConfig) {
  const groupRef  = useRef<THREE.Group>(null!);
  const wingLRef  = useRef<THREE.Mesh>(null!);
  const wingRRef  = useRef<THREE.Mesh>(null!);
  const prevAngle = useRef(phase);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * spd + phase;
    const px = Math.cos(t) * rx;
    const pz = Math.sin(t) * rz + 26;          // orbit centred over ocean
    const py = cy + Math.sin(t * 2.5) * 0.8;   // gentle altitude wobble

    // Heading: tangent of the ellipse
    const tx2 = -Math.sin(t) * rx;
    const tz2 =  Math.cos(t) * rz;
    const heading = Math.atan2(tx2, tz2);

    // Bank angle proportional to turn rate
    const dAngle = heading - prevAngle.current;
    prevAngle.current = heading;
    const bank = Math.max(-0.45, Math.min(0.45, dAngle * 18));

    groupRef.current.position.set(px, py, pz);
    groupRef.current.rotation.set(0, heading, bank);

    // Wing flap — faster when banking harder
    const flapSpeed = 7 + Math.abs(bank) * 4;
    const flap = Math.sin(clock.getElapsedTime() * flapSpeed) * 0.45;
    wingLRef.current.rotation.z =  flap;
    wingRRef.current.rotation.z = -flap;
  });

  const white = "#f5f5f5";
  const grey  = "#c8cdd0";
  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[sz * 0.10, sz * 0.55, 4, 8]} />
        <meshStandardMaterial color={white} roughness={0.85} />
      </mesh>
      {/* Head */}
      <mesh position={[0, sz * 0.05, sz * 0.34]}>
        <sphereGeometry args={[sz * 0.11, 8, 8]} />
        <meshStandardMaterial color={white} roughness={0.85} />
      </mesh>
      {/* Beak */}
      <mesh position={[0, sz * 0.02, sz * 0.47]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[sz * 0.025, sz * 0.12, 6]} />
        <meshStandardMaterial color="#e8a840" roughness={0.6} />
      </mesh>
      {/* Left wing pivot */}
      <group position={[-sz * 0.06, 0, 0]}>
        <mesh ref={wingLRef} position={[-sz * 0.38, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[sz * 0.72, sz * 0.035, sz * 0.18]} />
          <meshStandardMaterial color={white} roughness={0.8} />
        </mesh>
      </group>
      {/* Right wing pivot */}
      <group position={[sz * 0.06, 0, 0]}>
        <mesh ref={wingRRef} position={[sz * 0.38, 0, 0]}>
          <boxGeometry args={[sz * 0.72, sz * 0.035, sz * 0.18]} />
          <meshStandardMaterial color={white} roughness={0.8} />
        </mesh>
      </group>
      {/* Wing tips (darker) */}
      <mesh position={[-sz * 0.82, sz * 0.01, -sz * 0.02]}>
        <boxGeometry args={[sz * 0.2, sz * 0.03, sz * 0.12]} />
        <meshStandardMaterial color={grey} roughness={0.8} />
      </mesh>
      <mesh position={[sz * 0.82, sz * 0.01, -sz * 0.02]}>
        <boxGeometry args={[sz * 0.2, sz * 0.03, sz * 0.12]} />
        <meshStandardMaterial color={grey} roughness={0.8} />
      </mesh>
    </group>
  );
}

function Seagulls() {
  return (
    <group>
      {GULL_CONFIGS.map((cfg, i) => <Seagull key={i} {...cfg} />)}
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
      <hemisphereLight args={["#6ea8d8", "#9c7d3a", 0.28]} />
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
function useVolleyballPhysics(paused: boolean, onPoint: (scorer: "home" | "away") => void) {
  const onPointRef = useRef(onPoint);
  useEffect(() => { onPointRef.current = onPoint; }, [onPoint]);
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
    { pos: new THREE.Vector3(-4, 0, -2),  vel: new THREE.Vector3(), jumpT: 0, hitT: 0, diveT: 0, isJumping: false, facingAngle: 0, hitType: "set" },
    { pos: new THREE.Vector3(-6.5, 0, 1.5), vel: new THREE.Vector3(), jumpT: 0, hitT: 0, diveT: 0, isJumping: false, facingAngle: 0, hitType: "set" },
  ]);

  const awayPlayers = useRef<PlayerState[]>([
    { pos: new THREE.Vector3(4, 0, 2),    vel: new THREE.Vector3(), jumpT: 0, hitT: 0, diveT: 0, isJumping: false, facingAngle: 0, hitType: "set" },
    { pos: new THREE.Vector3(6.5, 0, -1.5), vel: new THREE.Vector3(), jumpT: 0, hitT: 0, diveT: 0, isJumping: false, facingAngle: 0, hitType: "set" },
  ]);

  // ── Rally state: tracks possession + 3-touch rule ──
  const rallyRef = useRef({
    touches:    0 as number,           // touches made this possession (0 = just received)
    side:       "away" as "home" | "away", // side currently in possession
    toucherIdx: -1 as number,          // player index (0|1) who made the last touch
    serveSide:  "home" as "home" | "away", // who serves next
  });
  const prevBallX = useRef(0);

  const resetBall = useCallback(() => {
    const b = ballRef.current;
    const r = rallyRef.current;

    // Alternate service each rally
    r.serveSide = r.serveSide === "home" ? "away" : "home";
    r.touches    = 0;
    r.toucherIdx = -1;
    r.side       = r.serveSide === "home" ? "away" : "home"; // receiving side

    const srvPlayers = r.serveSide === "home" ? homePlayers.current : awayPlayers.current;
    const server     = srvPlayers[0];
    const sideSign   = r.serveSide === "home" ? -1 : 1;
    const serveZ     = (Math.random() - 0.5) * 2;

    // Teleport server to behind baseline
    server.pos.set(sideSign * (COURT_HALF_X + 2.1), 0, serveZ);
    server.vel.set(0, 0, 0);

    // Ball starts at server hand height, then launches over the net
    const dirX    = r.serveSide === "home" ? 1 : -1;
    const targetZ = (Math.random() - 0.5) * 5;
    b.pos.set(server.pos.x, 1.8, server.pos.z);
    b.vel.set(
      dirX * (8.5 + Math.random() * 2.5),
      7.0 + Math.random() * 1.5,
      (targetZ - server.pos.z) * 0.55
    );
    b.angVel.set((Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5);
    b.bounceCount = 0;
    b.lastHitter  = r.serveSide;
    b.inPlay      = true;

    // Trigger serve animation (jump-serve look)
    server.hitType = "spike";
    server.jumpT   = 0.01;
    server.hitT    = 0.01;

    prevBallX.current = b.pos.x;
  }, []);

  const _tmpVec = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (paused) return;
    const clampedDt = Math.min(dt, 0.033);
    const b = ballRef.current;
    const r = rallyRef.current;

    // ── Gravity + air drag ──
    b.vel.y += GRAVITY * clampedDt;
    b.vel.multiplyScalar(Math.pow(DRAG, clampedDt * 60));
    b.angVel.multiplyScalar(Math.pow(0.97, clampedDt * 60));

    // ── Magnus effect (ω × v) — spinning ball curves ──
    const magnus = _tmpVec.crossVectors(b.angVel, b.vel).multiplyScalar(0.0014 * clampedDt);
    b.vel.add(magnus);

    b.pos.addScaledVector(b.vel, clampedDt);

    // ── Net crossing → new possession, reset touch count ──
    const px = prevBallX.current;
    prevBallX.current = b.pos.x;
    if (px * b.pos.x < 0 && Math.abs(b.vel.x) > 0.5) {
      r.touches    = 0;
      r.toucherIdx = -1;
      r.side       = b.pos.x < 0 ? "home" : "away";
    }

    // ── Sand floor: one bounce = point over ──
    if (b.pos.y - BALL_RADIUS <= 0) {
      b.pos.y = BALL_RADIUS;
      b.vel.y = -b.vel.y * 0.55;
      b.vel.x *= 0.70;
      b.vel.z *= 0.70;
      b.angVel.multiplyScalar(0.55);
      b.bounceCount++;
      b.onGround = Math.abs(b.vel.y) < 0.6;
      if (b.inPlay) {
        b.inPlay = false;
        // In-bounds: side who let it land loses; out-of-bounds: last hitter loses
        const outX = Math.abs(b.pos.x) > COURT_HALF_X;
        const outZ = Math.abs(b.pos.z) > COURT_HALF_Z;
        const scorer: "home" | "away" = (outX || outZ)
          ? (b.lastHitter === "home" ? "away" : "home")   // hitter hit it out
          : (b.pos.x < 0 ? "away" : "home");              // ball landed on their side
        onPointRef.current(scorer);
        setTimeout(resetBall, 1500);
      }
    }

    // ── Net collision ──
    if (Math.abs(b.pos.x) < 0.22 && b.pos.y < NET_HEIGHT + BALL_RADIUS && b.pos.y > 0.8) {
      b.vel.x  = -b.vel.x * 0.55;
      b.vel.y *= 0.7;
      b.pos.x  = Math.sign(b.pos.x || -1) * 0.26;
    }

    // ── Soft side boundaries ──
    if (Math.abs(b.pos.z) > 6.5) {
      b.vel.z = -b.vel.z * 0.65;
      b.pos.z = Math.sign(b.pos.z) * 6.5;
    }

    // ── Player AI — 3-touch rally system ──────────────────────────────────
    const sides: { side: "home" | "away"; players: PlayerState[] }[] = [
      { side: "home", players: homePlayers.current },
      { side: "away", players: awayPlayers.current },
    ];

    for (const { side, players } of sides) {
      const ballOnMySide = side === "home" ? b.pos.x < 0 : b.pos.x > 0;
      const myPossession = r.side === side && ballOnMySide;

      for (let pi = 0; pi < players.length; pi++) {
        const p = players[pi];
        const madeLastTouch = r.toucherIdx === pi && r.side === side;

        // ── Targeting ──
        let targetX: number, targetZ: number;

        if (ballOnMySide && b.inPlay) {
          const tFly  = estimateTimeToReach(b, PLAYER_REACH);
          const predX = Math.max(-COURT_HALF_X + 1, Math.min(COURT_HALF_X - 1, b.pos.x + b.vel.x * tFly));
          const predZ = Math.max(-COURT_HALF_Z + 0.5, Math.min(COURT_HALF_Z - 0.5, b.pos.z + b.vel.z * tFly));

          if (!myPossession || r.touches === 0) {
            // Receive: non-last-toucher chases; other recovers
            if (!madeLastTouch) { targetX = predX; targetZ = predZ; }
            else { targetX = side === "home" ? -6 : 6; targetZ = pi === 0 ? -2 : 2; }

          } else if (r.touches === 1) {
            // After dig: setter chases set target; digger recovers toward net
            if (!madeLastTouch) { targetX = predX; targetZ = predZ; }
            else {
              // Digger runs into attack approach position
              targetX = side === "home" ? -2.2 : 2.2;
              targetZ = predZ * 0.5;
            }

          } else { // touches === 2 — attack approach
            // Attacker (non-setter) closes on set ball
            if (!madeLastTouch) { targetX = predX; targetZ = predZ; }
            else {
              // Setter steps off — near net, own side
              targetX = side === "home" ? -3.0 : 3.0;
              targetZ = pi === 0 ? 1.5 : -1.5;
            }
          }
        } else {
          // Off-ball: return to base positions (wide beach-volleyball spread)
          const bx = side === "home" ? -1 : 1;
          targetX = bx * (pi === 0 ? 3.8 : 6.6);
          targetZ = pi === 0 ? -1.8 : 1.8;
        }

        // ── Sand-drag movement ──
        const toT = new THREE.Vector3(targetX - p.pos.x, 0, targetZ - p.pos.z);
        const dist = toT.length();
        if (dist > 0.15) {
          toT.normalize();
          p.vel.lerp(toT.multiplyScalar(PLAYER_SPEED), 7 * clampedDt);
          p.facingAngle = Math.atan2(p.vel.x, p.vel.z);
        } else {
          p.vel.multiplyScalar(0.08);
        }
        p.pos.addScaledVector(p.vel, clampedDt);

        // Clamp to half — but let server start outside baseline
        const outsideBaseline = Math.abs(p.pos.x) > COURT_HALF_X;
        if (!outsideBaseline) {
          p.pos.x = side === "home"
            ? Math.max(-COURT_HALF_X + 0.5, Math.min(-0.55, p.pos.x))
            : Math.max(0.55, Math.min(COURT_HALF_X - 0.5, p.pos.x));
        }
        p.pos.z = Math.max(-COURT_HALF_Z + 0.3, Math.min(COURT_HALF_Z - 0.3, p.pos.z));

        // ── Hit detection ──
        const hdx      = p.pos.x - b.pos.x;
        const hdz      = p.pos.z - b.pos.z;
        const distXZ   = Math.sqrt(hdx * hdx + hdz * hdz);
        const ballH    = b.pos.y;
        const reachH   = p.pos.y + 1.05;
        const inRange  = distXZ < 1.5 && Math.abs(ballH - reachH) < 1.9;
        const canHit   = ballOnMySide && inRange && !madeLastTouch && b.inPlay
                         && p.diveT === 0 && p.jumpT === 0;

        if (canHit) {
          const dirX    = side === "home" ? 1 : -1;
          const partner = players[1 - pi];

          if (!myPossession || r.touches === 0) {
            // ── TOUCH 1: RECEIVE — dig/pass high to partner (same side) ──
            const toPartner = new THREE.Vector3(
              partner.pos.x - b.pos.x, 0, partner.pos.z - b.pos.z
            );
            const pd = Math.max(1, toPartner.length());
            toPartner.normalize();
            b.vel.set(
              toPartner.x * Math.min(4.5, pd * 1.3),
              8.5 + Math.random() * 2,
              toPartner.z * Math.min(4.5, pd * 1.3)
            );
            b.angVel.set((Math.random()-0.5)*5, (Math.random()-0.5)*5, (Math.random()-0.5)*5);

            if (ballH < 1.15) {
              // Low ball — DIVE DIG
              p.hitType = "dig";
              p.diveT   = 0.01;
            } else {
              p.hitType = "set";
            }
            p.hitT       = 0.01;
            r.touches    = 1;
            r.toucherIdx = pi;
            r.side       = side;

          } else if (r.touches === 1) {
            // ── TOUCH 2: SET — high ball toward attack zone near net ──
            const attackX = side === "home" ? -2.0 : 2.0;
            const attackZ = (Math.random() - 0.5) * 2.8;
            const toAtk   = new THREE.Vector3(attackX - b.pos.x, 0, attackZ - b.pos.z);
            const ad      = Math.max(1, toAtk.length());
            toAtk.normalize();
            b.vel.set(
              toAtk.x * Math.min(5.5, ad * 1.4),
              9.5 + Math.random() * 2,
              toAtk.z * Math.min(5.5, ad * 1.4)
            );
            b.angVel.set((Math.random()-0.5)*4, (Math.random()-0.5)*4, (Math.random()-0.5)*4);

            p.hitType    = "set";
            p.hitT       = 0.01;
            r.touches    = 2;
            r.toucherIdx = pi;

          } else if (r.touches === 2) {
            // ── TOUCH 3: SPIKE — jump smash over net ──
            const targetZspike = (Math.random() - 0.5) * 5.5;
            const spikeSpeed   = 12.5 + Math.random() * 5;
            b.vel.set(
              dirX * spikeSpeed,
              2.2 + Math.random() * 1.2,
              (targetZspike - b.pos.z) * 0.78
            );
            b.angVel.set((Math.random()-0.5)*14, (Math.random()-0.5)*10, (Math.random()-0.5)*14);

            p.hitType    = "spike";
            p.jumpT      = 0.01;
            p.hitT       = 0.01;
            r.touches    = 3;
            b.lastHitter = side;
          }
        }

        // ── Advance animation timers ──
        if (p.hitT > 0) {
          p.hitT = Math.min(1, p.hitT + clampedDt * 2.6);
          if (p.hitT >= 1) p.hitT = 0;
        }
        if (p.jumpT > 0) {
          p.jumpT = Math.min(1, p.jumpT + clampedDt * 1.9);
          p.pos.y = Math.sin(p.jumpT * Math.PI) * (p.hitType === "spike" ? 1.05 : 0.55);
          if (p.jumpT >= 1) { p.jumpT = 0; p.pos.y = 0; }
        }
        if (p.diveT > 0) {
          p.diveT = Math.min(1, p.diveT + clampedDt * 1.8);
          p.pos.addScaledVector(p.vel, clampedDt * 0.55);
          if (p.diveT >= 1) { p.diveT = 0; }
        }
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
interface MatchState {
  homeScore: number;
  awayScore: number;
  homeSets:  number;
  awaySets:  number;
  currentSet: number;
  matchOver:  boolean;
  matchWinner: "home" | "away" | null;
}

function ScoreBoard({ match }: { match: MatchState }) {
  const setDots = (won: number) =>
    [0, 1].map(i => (
      <span
        key={i}
        className={`inline-block w-2.5 h-2.5 rounded-full border border-white/50 ${
          i < won ? "bg-white" : "bg-white/20"
        }`}
      />
    ));

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none select-none">
      {/* Set indicator */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 bg-black/50 backdrop-blur px-3 py-0.5 rounded-full">
        Set {match.currentSet} · First to 11
      </div>

      {/* Main scoreboard */}
      <div className="flex items-stretch gap-0 rounded-2xl overflow-hidden shadow-2xl border border-white/20">
        {/* Home */}
        <div className="bg-[#0077B6]/90 backdrop-blur px-5 py-2.5 text-white min-w-[90px] text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">HOME</div>
          <div className="text-4xl font-black tabular-nums leading-none">{match.homeScore}</div>
          <div className="flex justify-center gap-1 mt-1.5">{setDots(match.homeSets)}</div>
        </div>

        {/* Divider */}
        <div className="bg-black/70 backdrop-blur px-3 flex items-center text-white/50 text-xl font-black">:</div>

        {/* Away */}
        <div className="bg-[#E76F51]/90 backdrop-blur px-5 py-2.5 text-white min-w-[90px] text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">AWAY</div>
          <div className="text-4xl font-black tabular-nums leading-none">{match.awayScore}</div>
          <div className="flex justify-center gap-1 mt-1.5">{setDots(match.awaySets)}</div>
        </div>
      </div>

      {/* Match-over banner */}
      {match.matchOver && (
        <div className={`text-sm font-black uppercase tracking-widest px-6 py-1.5 rounded-full shadow-lg text-white ${
          match.matchWinner === "home" ? "bg-[#0077B6]" : "bg-[#E76F51]"
        }`}>
          {match.matchWinner === "home" ? "Home" : "Away"} wins the match!
        </div>
      )}
    </div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({ paused, autoRotate, onPoint }: {
  paused: boolean;
  autoRotate: boolean;
  onPoint: (scorer: "home" | "away") => void;
}) {
  const { ballRef, homePlayers, awayPlayers } = useVolleyballPhysics(paused, onPoint);

  const sandColor = "#dfc97a";

  return (
    <>
      <PixelRatioSetter />

      <PerspectiveCamera makeDefault position={[28, 8, 0]} fov={52} />
      <OrbitControls
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={8}
        maxDistance={45}
        target={[0, 1, 0]}
        enableDamping
        dampingFactor={0.06}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />

      {/* Sky */}
      <Sky
        sunPosition={[80, 22, 50]}
        turbidity={6}
        rayleigh={1.2}
        mieCoefficient={0.006}
        mieDirectionalG={0.84}
        inclination={0.495}
        azimuth={0.25}
      />

      {/* Lighting */}
      <SunLighting azimuth={135} elevation={42} intensity={2.6} />

      {/* Environment for reflections */}
      <Environment preset="sunset" backgroundIntensity={0} />

      {/* Sparkles near water side (ambient atmosphere) */}
      <Sparkles count={60} scale={[30, 4, 30]} size={0.8} speed={0.1} opacity={0.18} color="#fff9c4" />

      {/* Randomised clouds */}
      <Clouds material={THREE.MeshLambertMaterial} limit={80}>
        <Cloud position={[-18, 14, -10]} seed={1} scale={2.2} volume={5} color="#d8e8f5" fade={60} speed={0.55} opacity={0.55} bounds={[8, 2, 4]} segments={24} />
        <Cloud position={[20, 18, -16]} seed={3} scale={2.8} volume={6} color="#ccddef" fade={80} speed={0.40} opacity={0.45} bounds={[10, 2, 5]} segments={20} />
        <Cloud position={[4, 22, 22]} seed={7} scale={1.8} volume={4} color="#e0eaf6" fade={70} speed={0.70} opacity={0.38} bounds={[6, 1.5, 3]} segments={16} />
        <Cloud position={[-30, 16, 8]} seed={12} scale={3.2} volume={7} color="#d0e2f2" fade={90} speed={0.30} opacity={0.5} bounds={[12, 2, 6]} segments={28} />
        <Cloud position={[35, 20, -4]} seed={5} scale={2.4} volume={5} color="#cfe0f0" fade={75} speed={0.50} opacity={0.42} bounds={[9, 2, 4]} segments={22} />
        <Cloud position={[-8, 26, -28]} seed={9} scale={2.0} volume={4} color="#dde9f8" fade={65} speed={0.65} opacity={0.35} bounds={[7, 1.5, 3.5]} segments={18} />
        <Cloud position={[10, 19, 35]} seed={14} scale={2.6} volume={5} color="#d5e5f5" fade={85} speed={0.45} opacity={0.40} bounds={[9, 2, 4]} segments={20} />
        <Cloud position={[-22, 24, 18]} seed={6} scale={1.6} volume={3} color="#e5eefa" fade={55} speed={0.80} opacity={0.30} bounds={[5, 1.5, 3]} segments={14} />
      </Clouds>

      <BeachCourt sandColor={sandColor} />
      <SponsorBoards />
      <UmpireChair />
      <SpectatorStand />
      <Ocean />
      <Seagulls />

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
  const [autoRotate, setAutoRotate] = useState(false);
  const [key, setKey] = useState(0);

  const POINTS_TO_WIN = 11;
  const SETS_TO_WIN   = 2;

  const [match, setMatch] = useState<MatchState>({
    homeScore: 0, awayScore: 0,
    homeSets: 0,  awaySets: 0,
    currentSet: 1, matchOver: false, matchWinner: null,
  });

  const onPoint = useCallback((scorer: "home" | "away") => {
    setMatch(prev => {
      if (prev.matchOver) return prev;

      const homeScore = prev.homeScore + (scorer === "home" ? 1 : 0);
      const awayScore = prev.awayScore + (scorer === "away" ? 1 : 0);

      // Set won: first to POINTS_TO_WIN, must lead by 2
      const homeWonSet = homeScore >= POINTS_TO_WIN && homeScore - awayScore >= 2;
      const awayWonSet = awayScore >= POINTS_TO_WIN && awayScore - homeScore >= 2;

      if (homeWonSet || awayWonSet) {
        const homeSets = prev.homeSets + (homeWonSet ? 1 : 0);
        const awaySets = prev.awaySets + (awayWonSet ? 1 : 0);

        if (homeSets >= SETS_TO_WIN || awaySets >= SETS_TO_WIN) {
          return {
            homeScore, awayScore, homeSets, awaySets,
            currentSet: prev.currentSet,
            matchOver: true,
            matchWinner: homeSets >= SETS_TO_WIN ? "home" : "away",
          };
        }
        // Start next set
        return {
          homeScore: 0, awayScore: 0, homeSets, awaySets,
          currentSet: prev.currentSet + 1,
          matchOver: false, matchWinner: null,
        };
      }

      return { ...prev, homeScore, awayScore };
    });
  }, []);

  const selectedLocation = useMemo(
    () => locations?.find(l => l.id.toString() === selectedLocId) || locations?.[0],
    [locations, selectedLocId]
  );

  const activePlayers = roster?.activePlayers ?? [];

  return (
    <div className="h-[calc(100vh-11rem)] w-full rounded-3xl overflow-hidden relative border border-primary/20 shadow-2xl">
      <Canvas
        key={key}
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.76,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
      >
        <Scene paused={paused} autoRotate={autoRotate} onPoint={onPoint} />
      </Canvas>

      {/* Score */}
      <ScoreBoard match={match} />

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
          variant={autoRotate ? "default" : "outline"}
          className={`backdrop-blur gap-2 h-9 border-white/20 shadow-xl ${autoRotate ? "" : "bg-background/80"}`}
          onClick={() => setAutoRotate(r => !r)}
        >
          <RefreshCw className={`h-4 w-4 ${autoRotate ? "animate-spin" : ""}`} />
          {autoRotate ? "360° ON" : "360°"}
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
        {!selectedLocation && (
          <Card className="bg-background/80 backdrop-blur border-white/20 shadow-xl">
            <CardHeader className="p-3 pb-1.5">
              <CardTitle className="text-xs font-bold flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary" /> VENUE
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-3">
              <Select onValueChange={setSelectedLocId} value={selectedLocId}>
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
            </CardContent>
          </Card>
        )}

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
