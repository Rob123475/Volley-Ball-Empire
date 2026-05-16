import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, ContactShadows, PerspectiveCamera } from "@react-three/drei";
import { useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useListLocations } from "@workspace/api-client-react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CloudSun, MapPin, Wind } from "lucide-react";

function Ball() {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Arcing motion over the net (x axis is across the net)
    meshRef.current.position.x = Math.sin(time * 2) * 8;
    meshRef.current.position.y = Math.abs(Math.cos(time * 2)) * 4 + 0.5;
    meshRef.current.position.z = 0;
    
    meshRef.current.rotation.x += 0.05;
    meshRef.current.rotation.y += 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial color="#fcd34d" emissive="#fcd34d" emissiveIntensity={0.2} />
    </mesh>
  );
}

function Player({ position, color }: { position: [number, number, number], color: string }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    // Gentle bobbing
    meshRef.current.position.y = position[1] + Math.sin(time * 2 + position[0]) * 0.1;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <capsuleGeometry args={[0.4, 1, 4, 8]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Court() {
  return (
    <group>
      {/* Sandy ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#f3e5ab" roughness={1} />
      </mesh>

      {/* Court boundaries (Box geometries for lines) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[18, 0.01, 9]} />
        <meshStandardMaterial color="white" transparent opacity={0.5} />
      </mesh>
      
      {/* Perimeter lines */}
      <mesh position={[0, 0.01, 4.5]}>
        <boxGeometry args={[18, 0.02, 0.1]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.01, -4.5]}>
        <boxGeometry args={[18, 0.02, 0.1]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[9, 0.01, 0]}>
        <boxGeometry args={[0.1, 0.02, 9]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-9, 0.01, 0]}>
        <boxGeometry args={[0.1, 0.02, 9]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Net Posts */}
      <mesh position={[0, 1.25, 5]}>
        <boxGeometry args={[0.2, 2.5, 0.2]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 1.25, -5]}>
        <boxGeometry args={[0.2, 2.5, 0.2]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Net */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[0.05, 1, 10]} />
        <meshStandardMaterial color="#333" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

export default function ThreeDCourt() {
  const { data: locations } = useListLocations();
  const [selectedLocId, setSelectedLocId] = useState<string>("");
  
  const selectedLocation = useMemo(() => 
    locations?.find(l => l.id.toString() === selectedLocId) || locations?.[0],
    [locations, selectedLocId]
  );

  return (
    <div className="h-[calc(100vh-12rem)] w-full rounded-3xl overflow-hidden relative border border-primary/20 bg-muted/20">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[15, 10, 15]} />
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} castShadow />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        {/* Sun Sphere */}
        <mesh position={[50, 20, 50]}>
          <sphereGeometry args={[5, 32, 32]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>

        <Court />
        <Ball />
        
        {/* Home Team Players */}
        <Player position={[-5, 0.7, -2]} color="#0077B6" />
        <Player position={[-5, 0.7, 2]} color="#0077B6" />
        
        {/* Away Team Players */}
        <Player position={[5, 0.7, -2]} color="#E76F51" />
        <Player position={[5, 0.7, 2]} color="#E76F51" />

        <ContactShadows opacity={0.4} scale={20} blur={2.4} far={4.5} />
        <OrbitControls minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      {/* Overlay UI */}
      <div className="absolute top-6 left-6 w-72 space-y-4">
        <Card className="bg-background/80 backdrop-blur border-primary/20 shadow-xl">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> LOCATION PREVIEW
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <Select onValueChange={setSelectedLocId} value={selectedLocId || selectedLocation?.id.toString()}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select Location" />
              </SelectTrigger>
              <SelectContent>
                {locations?.map(l => (
                  <SelectItem key={l.id} value={l.id.toString()}>{l.city}, {l.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedLocation && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase">Weather</span>
                  <Badge variant="outline" className="gap-1">
                    <CloudSun className="h-3 w-3" /> {selectedLocation.weatherPatterns}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground uppercase">Court Type</span>
                  <Badge className="bg-secondary text-secondary-foreground">{selectedLocation.courtType}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="absolute bottom-6 right-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur rounded-full border border-primary/20 text-xs font-bold text-primary">
          <Wind className="h-4 w-4 animate-pulse" /> LIVE SIMULATION VIEW
        </div>
      </div>
    </div>
  );
}
