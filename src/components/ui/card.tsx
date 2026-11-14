import { cn } from "@/lib/utils";

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...p} />;
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn("p-5", className)} {...p} />;
