"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Text } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import * as THREE from "three";

/** One agent entry from the Operations Dashboard telemetry snapshot. */
interface Agent {
  name: string;
  status: string;
  sessions?: number | null;
  tokens?: number | null;
  credits?: number | null;
  gateway?: string | null;
}

/** Shape returned by GET /api/telemetry (see Tools/OperationsDashboard/server.py). */
interface Snapshot {
  updatedAt: string | null;
  agents: Agent[];
  dreams?: unknown[];
  ledger?: unknown;
  backlog?: unknown[];
  guidance?: unknown[];
  milestones?: unknown[];
  user_intent?: unknown;
}

type FeedState = "loading" | "online" | "offline";

function AgentNode({
  position,
  name,
  status,
}: {
  position: [number, number, number];
  name: string;
  status: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color =
    status === "online" ? "#22c55e" : status === "idle" ? "#eab308" : "#64748b";

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
      meshRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.2;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} wireframe />
      </mesh>
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.4}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
      <Text
        position={[0, -2, 0]}
        fontSize={0.25}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {status}
      </Text>
    </group>
  );
}

export default function Home() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feed, setFeed] = useState<FeedState>("loading");

  useEffect(() => {
    // Same-origin request (proxied to the dashboard by next.config.mjs).
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry");
        if (res.ok) {
          const data: Snapshot = await res.json();
          setSnapshot(data);
          setFeed("online");
        } else {
          setFeed("offline");
        }
      } catch {
        setFeed("offline");
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  const agents = snapshot?.agents ?? [];

  return (
    <main className="w-screen h-screen bg-slate-900">
      <div className="absolute top-4 left-4 z-10 p-4 bg-slate-800/80 rounded-lg border border-slate-700 shadow-xl backdrop-blur-sm">
        <h1 className="text-xl font-bold text-white mb-2">
          Spatial Operations Center
        </h1>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              feed === "online"
                ? "bg-green-500"
                : feed === "offline"
                  ? "bg-red-500"
                  : "bg-yellow-400 animate-pulse"
            }`}
            aria-hidden="true"
          />
          <span
            className={`text-sm ${
              feed === "online"
                ? "text-green-400"
                : feed === "offline"
                  ? "text-red-400"
                  : "text-yellow-300"
            }`}
            role="status"
          >
            {feed === "online"
              ? "Telemetry feed online"
              : feed === "offline"
                ? "Telemetry feed offline — start Tools/OperationsDashboard on :8765"
                : "Connecting to telemetry feed…"}
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          Active Sessions:{" "}
          {agents.reduce((acc, a) => acc + (a.sessions || 0), 0)}
          <br />
          Total Tokens: {agents.reduce((acc, a) => acc + (a.tokens || 0), 0)}
        </p>
      </div>

      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars
          radius={100}
          depth={50}
          count={5000}
          factor={4}
          saturation={0}
          fade
          speed={1}
        />

        {agents.map((agent, index) => {
          // Arrange in a circle
          const angle = (index / agents.length) * Math.PI * 2;
          const radius = 4;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;

          return (
            <AgentNode
              key={`${agent.name}-${index}`}
              position={[x, 0, z]}
              name={agent.name}
              status={agent.status}
            />
          );
        })}

        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </main>
  );
}
