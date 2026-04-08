"use client";

import { Check } from "lucide-react";

interface Step {
  step: number;
  name_jp: string;
  name_en: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps?: number[];
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps = [],
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1.5 px-1">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(step.step);
        const isCurrent = step.step === currentStep;
        const isPast = step.step < currentStep;

        return (
          <div key={step.step} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-4 h-px mx-0.5 ${
                  isPast || isCompleted ? "bg-gray-400" : "bg-gray-200"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-all ${
                  isCurrent
                    ? "bg-gray-900 text-white ring-2 ring-gray-300 ring-offset-1"
                    : isCompleted || isPast
                      ? "bg-gray-200 text-gray-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isCompleted || isPast ? (
                  <Check className="h-3 w-3" />
                ) : (
                  step.step
                )}
              </div>
              <span
                className={`text-[9px] whitespace-nowrap max-w-[56px] truncate ${
                  isCurrent
                    ? "text-gray-900 font-semibold"
                    : "text-gray-400"
                }`}
                title={step.name_jp}
              >
                {step.name_jp}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
