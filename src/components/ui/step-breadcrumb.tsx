"use client";
import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepBreadcrumbStep {
  id: string;
  name: string;
  status: "complete" | "current" | "upcoming";
}

interface StepBreadcrumbProps {
  className?: string;
  steps?: StepBreadcrumbStep[];
}

export function Breadcrumb({
  className,
  steps = [
    { id: "01", name: "Cart", status: "complete" },
    { id: "02", name: "Shipping", status: "current" },
    { id: "03", name: "Payment", status: "upcoming" },
    { id: "04", name: "Confirmation", status: "upcoming" },
  ],
}: StepBreadcrumbProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 500);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {steps.map((step, stepIdx) => {
          const isLast = stepIdx === steps.length - 1;
          const isComplete = step.status === "complete";
          const isCurrent = step.status === "current";

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center",
                !isLast && "flex-1"
              )}
            >
              <div className="flex flex-col items-center min-w-0">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300",
                    "w-8 h-8 sm:w-9 sm:h-9 text-xs font-bold",
                    isComplete && "bg-[#007185] text-white shadow-sm",
                    isCurrent && "bg-[#FFD814] text-[#0F1111] ring-2 ring-[#FCD200] ring-offset-2 ring-offset-white scale-110",
                    !isComplete && !isCurrent && "bg-[#F2F4F8] text-[#8B96A5] border border-[#D5D9D9]"
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-[10px] sm:text-xs font-medium whitespace-nowrap transition-colors",
                    isComplete && "text-[#007185]",
                    isCurrent && "text-[#0F1111] font-bold",
                    !isComplete && !isCurrent && "text-[#8B96A5]"
                  )}
                >
                  {step.name}
                </span>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-[2px] mx-1 sm:mx-2 mb-5 transition-colors duration-300",
                    isComplete ? "bg-[#007185]" : "bg-[#E3E6EA]"
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
