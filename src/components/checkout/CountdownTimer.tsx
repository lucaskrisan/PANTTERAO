import { useState, useEffect } from "react";

interface CountdownTimerProps {
  minutes?: number;
  isUSD?: boolean;
  /** Texto antes do timer (i18n). Tem precedência sobre isUSD. */
  prefix?: string;
  /** Texto depois do timer (i18n). Tem precedência sobre isUSD. */
  suffix?: string;
}

const CountdownTimer = ({ minutes = 15, isUSD = false, prefix, suffix }: CountdownTimerProps) => {
  const [seconds, setSeconds] = useState(minutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  const resolvedPrefix = prefix ?? (isUSD ? "🛒 Your order is reserved for " : "🛒 Seu pedido está reservado por ");
  const resolvedSuffix = suffix ?? (isUSD ? " — Complete checkout!" : " — Complete o checkout!");

  return (
    <div className="fixed top-0 left-0 w-full z-[9999]">
      <div
        className="text-center py-2.5 px-4 text-sm font-bold tracking-wide"
        style={{ backgroundColor: "hsl(215, 27%, 19%)", color: "#fff" }}
      >
        {resolvedPrefix}
        <span className="font-mono text-base" style={{ color: "hsl(47, 95%, 53%)" }}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        {resolvedSuffix}
      </div>
      <div
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #FFD814, #e77600, #FFD814)",
          backgroundSize: "200% 200%",
          animation: "gradientMove 3s ease infinite",
        }}
      />
      <style>{`@keyframes gradientMove { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
    </div>
  );
};

export default CountdownTimer;
