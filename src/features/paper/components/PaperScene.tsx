"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  AnimationMixer,
  AnimationClip,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  PMREMGenerator,
  type AnimationAction,
  type Group,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { PAPER_MODEL_URL, paperMoods, type PaperMood } from "../paper-mood";

const CROSSFADE_SECONDS = 0.35;

/**
 * El GLB trae deformaciones muy exageradas para las gafas. Conservamos el
 * lenguaje corporal de cada clip, pero dejamos el rostro neutral y legible.
 */
function withoutGlassesMorphs(clip: AnimationClip) {
  return new AnimationClip(
    clip.name,
    clip.duration,
    clip.tracks.filter((track) => !track.name.endsWith(".morphTargetInfluences")),
  );
}

function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    // Reflejos suaves para el acetato y el clearcoat de las gafas.
    const generator = new PMREMGenerator(gl);
    const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    return () => {
      scene.environment = null;
      environment.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface PaperModelProps {
  mood: PaperMood;
  reducedMotion: boolean;
  followPointer: boolean;
}

function PaperModel({ mood, reducedMotion, followPointer }: PaperModelProps) {
  const gltf = useLoader(GLTFLoader, PAPER_MODEL_URL);
  // Cada instancia necesita su propio esqueleto: el mismo GLB puede aparecer
  // en la portada y en el onboarding a la vez.
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const mixer = useMemo(() => new AnimationMixer(scene), [scene]);
  const clips = useMemo(() => gltf.animations.map(withoutGlassesMorphs), [gltf.animations]);
  const leftHand = useMemo(() => scene.getObjectByName("Hand.L") ?? scene.getObjectByName("HandL"), [scene]);
  const rightHand = useMemo(() => scene.getObjectByName("Hand.R") ?? scene.getObjectByName("HandR"), [scene]);
  const groupRef = useRef<Group>(null);
  const currentAction = useRef<AnimationAction | null>(null);

  useEffect(() => () => {
    mixer.stopAllAction();
    mixer.uncacheRoot(scene);
  }, [mixer, scene]);

  useEffect(() => {
    const definition = paperMoods[mood];
    const clip = clips.find((candidate) => candidate.name === definition.clip);
    if (!clip) return;

    const next = mixer.clipAction(clip);
    const previous = currentAction.current;
    next.reset();
    next.setLoop(definition.once ? LoopOnce : LoopRepeat, Infinity);
    next.clampWhenFinished = definition.once;

    if (reducedMotion) {
      // Pose fija y expresiva, sin movimiento continuo.
      previous?.stop();
      next.play();
      next.time = clip.duration * 0.5;
      next.paused = true;
      mixer.update(0);
      currentAction.current = next;
      return;
    }

    next.fadeIn(CROSSFADE_SECONDS).play();
    if (previous && previous !== next) previous.fadeOut(CROSSFADE_SECONDS);
    currentAction.current = next;

    if (!definition.once) return;
    const idleClip = clips.find((candidate) => candidate.name === paperMoods.idle.clip);
    const onFinished = (event: { action: AnimationAction }) => {
      if (event.action !== next || !idleClip) return;
      const idle = mixer.clipAction(idleClip);
      idle.reset().setLoop(LoopRepeat, Infinity).fadeIn(CROSSFADE_SECONDS).play();
      next.fadeOut(CROSSFADE_SECONDS);
      currentAction.current = idle;
    };
    mixer.addEventListener("finished", onFinished);
    return () => mixer.removeEventListener("finished", onFinished);
  }, [clips, mixer, mood, reducedMotion]);

  useFrame((state, delta) => {
    mixer.update(reducedMotion ? 0 : delta);

    // El rig original deja ambas manos demasiado separadas de la hoja.
    // Mantenemos sus gestos y rotaciones, pero las anclamos visualmente al cuerpo.
    if (leftHand) leftHand.position.x = 1.14;
    if (rightHand) rightHand.position.x = -1.14;

    const group = groupRef.current;
    if (group && followPointer && !reducedMotion) {
      group.rotation.y = MathUtils.damp(group.rotation.y, state.pointer.x * 0.18, 4, delta);
      group.rotation.x = MathUtils.damp(group.rotation.x, -state.pointer.y * 0.05, 4, delta);
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.84, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export interface PaperSceneProps {
  mood: PaperMood;
  active: boolean;
  reducedMotion: boolean;
  followPointer: boolean;
}

export default function PaperScene({ mood, active, reducedMotion, followPointer }: PaperSceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      camera={{ position: [0, 0, 10.2], fov: 27 }}
      dpr={2}
      frameloop={active ? (reducedMotion ? "demand" : "always") : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.38} />
      <hemisphereLight args={["#fff8ec", "#b9aa91", 0.45]} />
      <directionalLight position={[3, 5, 6]} intensity={1.15} />
      <directionalLight position={[-4, 2, -3]} intensity={0.3} color="#f4c8dc" />
      <SceneEnvironment />
      <Suspense fallback={null}>
        <PaperModel mood={mood} reducedMotion={reducedMotion} followPointer={followPointer} />
      </Suspense>
    </Canvas>
  );
}
