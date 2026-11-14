import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-red-100 text-red-700",
      solidDanger: "bg-destructive text-destructive-foreground shadow-sm", neutral: "bg-secondary text-slate-600",
    },
  },
  defaultVariants: { variant: "neutral" },
});
export const Badge = ({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) =>
  <span className={cn(badgeVariants({ variant }), className)} {...p} />;
