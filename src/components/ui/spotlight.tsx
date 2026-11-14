// Aceternity-style "Spotlight" + animated aurora backdrop, used on the login page only.
import { cn } from "@/lib/utils";

export function Spotlight({ className }: { className?: string }) {
  return (
    <svg className={cn("pointer-events-none absolute z-0 h-[169%] w-[138%] animate-spotlight opacity-0 lg:w-[84%]", className)}
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3787 2842" fill="none">
      <g filter="url(#f)"><ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501" transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)" fill="white" fillOpacity="0.21" /></g>
      <defs><filter id="f" x="0.86" y="0.84" width="3785.16" height="2840.26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feFlood floodOpacity="0" result="a" /><feBlend in="SourceGraphic" in2="a" result="s" /><feGaussianBlur stdDeviation="151" /></filter></defs>
    </svg>
  );
}

export function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 animate-aurora [background-size:200%_200%]"
        style={{ backgroundImage: "linear-gradient(115deg, #c61a09, #8f1004, #d92b19, #6e0c03)" }} />
      <div className="absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:22px_22px]" />
    </div>
  );
}
