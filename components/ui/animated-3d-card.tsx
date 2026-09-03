"use client";

import { useCallback, useId, useState, type ReactNode, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/**
 * Kartu dengan efek tilt 3D mengikuti gerakan mouse (framer-motion) + gradient
 * indigo/violet senada tema AyoTKA. Cuma bungkus tilt/gradient/glossy sheen -
 * konten (icon, judul, harga, tombol, dst) dikirim lewat children supaya bisa
 * dipakai baik untuk kartu fitur maupun kartu paket yang layoutnya beda.
 * Tilt & glossy sheen dimatikan kalau prefers-reduced-motion aktif.
 */
export function Tilt3DCard({
  children,
  gradient = "from-indigo-600 via-indigo-700 to-violet-800",
  className,
}: {
  children: ReactNode;
  gradient?: string;
  className?: string;
}) {
  const patternId = useId();
  const reduceMotion = useReducedMotion();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (reduceMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setMousePos({ x: (x / rect.width - 0.5) * 20, y: (y / rect.height - 0.5) * -20 });
    },
    [reduceMotion],
  );

  const handleLeave = useCallback(() => {
    setHovered(false);
    setMousePos({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      className={cn(
        "group relative flex h-full w-full transform-gpu flex-col overflow-hidden rounded-2xl shadow-lg transition-shadow duration-500 hover:shadow-2xl hover:shadow-indigo-900/20",
        className,
      )}
      onMouseMove={handleMove}
      onMouseEnter={() => !reduceMotion && setHovered(true)}
      onMouseLeave={handleLeave}
      animate={{ rotateX: mousePos.y, rotateY: mousePos.x, z: hovered ? 30 : 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 35, mass: 0.8 }}
      style={{ transformStyle: "preserve-3d", perspective: "1200px" }}
    >
      <div
        className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br", gradient)}
        style={{ transform: "translateZ(-10px)" }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-20">
        <svg className="absolute -right-4 -top-4 h-32 w-32 text-white/30" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <pattern id={patternId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill={`url(#${patternId})`} />
        </svg>
      </div>

      {!reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          style={{ transform: "translateZ(15px)" }}
        >
          <motion.div
            className="absolute -inset-full"
            animate={{
              background: hovered
                ? `linear-gradient(${mousePos.x + 135}deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)`
                : "transparent",
            }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}

      <div
        className="relative z-20 flex h-full flex-1 flex-col text-white"
        style={{ transform: "translateZ(20px)" }}
      >
        {children}
      </div>
    </motion.div>
  );
}
