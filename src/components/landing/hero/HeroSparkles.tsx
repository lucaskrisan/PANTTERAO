import { motion } from "framer-motion";

export default function HeroSparkles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sparkle particles */}
      {[...Array(40)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: i % 5 === 0 ? 3 : 2,
            height: i % 5 === 0 ? 3 : 2,
            background: i % 3 === 0
              ? "hsl(151, 100%, 45%)"
              : i % 3 === 1
              ? "hsl(43, 64%, 52%)"
              : "rgba(255,255,255,0.4)",
          }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "easeInOut",
          }}
        />
      ))}
      {/* Green glow orbs */}
      <div className="absolute top-1/4 right-1/3 w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(0,230,118,0.08)_0%,_transparent_60%)] blur-2xl" />
      <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-[radial-gradient(circle,_rgba(0,200,83,0.05)_0%,_transparent_60%)] blur-2xl" />
      {/* Gold glow orb */}
      <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-[radial-gradient(circle,_rgba(212,175,55,0.06)_0%,_transparent_60%)] blur-2xl" />
    </div>
  );
}
