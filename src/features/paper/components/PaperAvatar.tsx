"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { paperMoods, type PaperMood } from "../paper-mood";

interface PaperAvatarProps {
  mood?: PaperMood;
  size?: "sm" | "md" | "lg" | "hero";
  interactive?: boolean;
  onReact?: (mood: PaperMood) => void;
  className?: string;
  followPointer?: boolean;
}

type HandAsset =
  | "hand_right_idle"
  | "hand_point_right"
  | "hand_present"
  | "hand_thumbs_up"
  | "hand_wave";

interface HandPose {
  asset: HandAsset;
  placement: string;
  side: "left" | "right";
  mirror?: boolean;
}

interface PaperPose {
  hand: HandPose;
}

const PAPER_POSES: Record<PaperMood, PaperPose> = {
  idle: {
    hand: { asset: "hand_right_idle", placement: "idle", side: "right" },
  },
  greeting: {
    hand: { asset: "hand_wave", placement: "wave", side: "left" },
  },
  thinking: {
    hand: { asset: "hand_present", placement: "thinking", side: "right" },
  },
  presenting: {
    hand: { asset: "hand_present", placement: "present", side: "right" },
  },
  pointing: {
    hand: { asset: "hand_point_right", placement: "point", side: "right" },
  },
  approving: {
    hand: { asset: "hand_thumbs_up", placement: "approve", side: "right" },
  },
  surprised: {
    hand: { asset: "hand_wave", placement: "surprised", side: "left" },
  },
};

const GLASSES_POSES: Record<PaperMood, { column: 0 | 1 | 2; row: 0 | 1 | 2; opticalOffsetY: number }> = {
  idle: { column: 0, row: 0, opticalOffsetY: 0 },
  greeting: { column: 1, row: 0, opticalOffsetY: 1.8 },
  thinking: { column: 0, row: 1, opticalOffsetY: 12.7 },
  presenting: { column: 1, row: 1, opticalOffsetY: 12.8 },
  pointing: { column: 2, row: 1, opticalOffsetY: 8.4 },
  approving: { column: 1, row: 0, opticalOffsetY: 1.8 },
  surprised: { column: 2, row: 2, opticalOffsetY: -3.9 },
};

function spritePosition(column: number, row: number) {
  return `${column * 50}% ${row * 50}%`;
}

// Respiración idle: ciclos lentos y casi imperceptibles; manos y cuerpo con duraciones distintas para que no se sienta mecánico.
const IDLE_BREATH_SECONDS = 4.8;

function handMotion(mood: PaperMood) {
  if (mood === "idle") {
    return { x: 0, y: [0, 1.6, 0], rotate: [0, 1.1, 0], scale: 1 };
  }
  if (mood === "greeting") return { y: [3, -4, 0], rotate: [0, 13, -8, 10, 0] };
  if (mood === "approving") return { y: [4, -7, 0], rotate: [0, -5, 2, 0], scale: [0.97, 1.045, 1] };
  if (mood === "pointing") return { x: [-4, 10, 5], y: [0, 2, 1], rotate: [0, 4, 2] };
  if (mood === "presenting") return { y: [4, -6, 0], rotate: [-3, 2, 0] };
  if (mood === "surprised") return { y: [7, -8, 0], rotate: [-6, 4, 0] };
  if (mood === "thinking") return { x: [2, -4, 0], rotate: [-2, 4, 0] };
  return { x: 0, y: 0, rotate: 0, scale: 1 };
}

function bodyMotion(mood: PaperMood) {
  if (mood === "idle") return { x: 0, y: [0, -2.5, 0], rotate: [0, 0.35, 0], scaleY: [1, 1.012, 1], scaleX: [1, 0.997, 1] };
  if (mood === "greeting") return { y: [2, -6, 0], rotate: [0, -0.8, 0], scale: [0.99, 1.018, 1] };
  if (mood === "approving") return { y: [2, -7, 0], rotate: [0, 0.7, 0], scale: [0.99, 1.02, 1] };
  if (mood === "surprised") return { y: [3, -8, 0], rotate: [0, -0.8, 0.8, 0], scale: [0.985, 1.025, 1] };
  return { y: [2, -4, 0], rotate: [0, 0.45, 0], scale: [0.995, 1.01, 1] };
}

function PaperHand({ pose, mood, reducedMotion }: {
  pose: HandPose;
  mood: PaperMood;
  reducedMotion: boolean;
}) {
  const idle = mood === "idle";

  return (
    <motion.div
      key={`${pose.asset}-${pose.side}-${mood}`}
      className={`paper-sprite__hand paper-sprite__hand--active paper-sprite__hand--${pose.placement} paper-sprite__hand--side-${pose.side}`}
      initial={reducedMotion || idle ? false : { y: 4, scale: 0.97, rotate: 0 }}
      animate={reducedMotion ? { x: 0, y: 0, rotate: 0, scale: 1 } : handMotion(mood)}
      transition={
        idle
          ? { duration: 5.7, repeat: Infinity, ease: "easeInOut" }
          : { duration: mood === "greeting" ? 1.05 : mood === "pointing" ? 0.9 : 0.72, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <img
        src={`/paper/${pose.asset}.png`}
        alt=""
        width={568}
        height={549}
        draggable={false}
        className={pose.mirror ? "paper-sprite__mirrored" : undefined}
      />
    </motion.div>
  );
}

function PaperGlasses({ mood, reducedMotion }: { mood: PaperMood; reducedMotion: boolean }) {
  const idle = mood === "idle";
  const pose = GLASSES_POSES[mood];
  const action =
    mood === "surprised"
      ? { y: [2, -6, 0], rotate: [0, -2.2, 1.4, 0], scale: [1, 1.025, 1] }
      : mood === "thinking"
        ? { y: [0, 2, 0], rotate: [0, -2, 0] }
        : mood === "approving"
          ? { y: [1, -3, 0], rotate: [0, 1.2, 0] }
          : { y: [0, -2, 0], rotate: [0, 0.8, 0] };

  return (
    <motion.span
      key={`glasses-${mood}`}
      className="paper-sprite__layer paper-sprite__glasses"
      initial={reducedMotion || idle ? false : { y: 2, rotate: 0, scale: 0.99 }}
      animate={reducedMotion ? { y: 0, rotate: 0, scale: 1, opacity: 1 } : idle ? { y: [0, -0.8, 0], rotate: 0, scale: 1 } : action}
      transition={
        idle
          ? { duration: IDLE_BREATH_SECONDS, repeat: Infinity, ease: "easeInOut" }
          : { duration: mood === "surprised" ? 0.82 : 0.65, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <span
        className="paper-sprite__glasses-art"
        style={{
          backgroundImage: "url(/paper/glasses-expressions.png)",
          backgroundPosition: spritePosition(pose.column, pose.row),
          transform: `translateY(${pose.opticalOffsetY}%)`,
        }}
      />
    </motion.span>
  );
}

export function PaperAvatar({
  mood = "idle",
  size = "md",
  interactive = true,
  onReact,
  className = "",
  followPointer = true,
}: PaperAvatarProps) {
  const [currentMood, setCurrentMood] = useState<PaperMood>(mood);
  const [canFollowPointer, setCanFollowPointer] = useState(false);
  const reactionTimeout = useRef<number | null>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateY = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.6 });
  const rotateX = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.6 });
  const pose = PAPER_POSES[currentMood];

  useEffect(() => {
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updatePointerCapability = () => setCanFollowPointer(pointerQuery.matches);
    updatePointerCapability();
    pointerQuery.addEventListener("change", updatePointerCapability);
    return () => pointerQuery.removeEventListener("change", updatePointerCapability);
  }, []);

  useEffect(() => {
    if (reactionTimeout.current !== null) {
      window.clearTimeout(reactionTimeout.current);
      reactionTimeout.current = null;
    }

    setCurrentMood(mood);
    if (!paperMoods[mood].once) return;

    const timeout = window.setTimeout(
      () => setCurrentMood("idle"),
      reducedMotion ? 500 : 2200,
    );
    return () => window.clearTimeout(timeout);
  }, [mood, reducedMotion]);

  useEffect(() => () => {
    if (reactionTimeout.current !== null) window.clearTimeout(reactionTimeout.current);
  }, []);

  const reactOnce = (next: PaperMood) => {
    if (reactionTimeout.current !== null) window.clearTimeout(reactionTimeout.current);
    setCurrentMood(next);
    onReact?.(next);
    reactionTimeout.current = window.setTimeout(() => {
      setCurrentMood(mood);
      reactionTimeout.current = null;
    }, reducedMotion ? 500 : 2200);
  };

  const handleClick = () => {
    if (!interactive) return;
    const reactions: PaperMood[] = ["greeting", "thinking", "presenting", "approving", "surprised"];
    reactOnce(reactions[Math.floor(Math.random() * reactions.length)]);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!followPointer || !canFollowPointer || reducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    pointerX.set(x * 7);
    pointerY.set(y * -4);
  };

  const resetPointer = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  const moodDesc = paperMoods[currentMood]?.description ?? "guía cívico";

  return (
    <div
      className={`paper-avatar-wrapper paper-avatar-wrapper--${size} ${className}`}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Paper, guía interactivo: ${moodDesc}`}
      title={interactive ? "Haz clic para interactuar con Paper" : undefined}
    >
      <motion.div
        className="paper-sprite-perspective"
        style={!reducedMotion && followPointer && canFollowPointer ? { rotateX, rotateY } : undefined}
      >
        <motion.div
          className="paper-sprite"
          aria-hidden="true"
          initial={false}
          animate={reducedMotion ? { x: 0, y: 0, rotate: 0, scale: 1 } : bodyMotion(currentMood)}
          transition={
            currentMood === "idle"
              ? { duration: 5.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: currentMood === "surprised" ? 0.86 : 0.72, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <img
            className="paper-sprite__layer paper-sprite__back"
            src="/paper/paper_back.png"
            alt=""
            width={520}
            height={630}
            draggable={false}
          />
          <img
            className="paper-sprite__layer paper-sprite__front"
            src="/paper/paper_front.png"
            alt=""
            width={486}
            height={602}
            draggable={false}
          />
          <PaperHand pose={pose.hand} mood={currentMood} reducedMotion={reducedMotion} />
          <PaperGlasses mood={currentMood} reducedMotion={reducedMotion} />
        </motion.div>
      </motion.div>
    </div>
  );
}
