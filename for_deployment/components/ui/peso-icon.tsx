import { cn } from "@/lib/utils"

interface PesoIconProps {
  className?: string
  size?: number
}

export function PesoIcon({ className, size }: PesoIconProps) {
  return (
    <span 
      className={cn("font-bold inline-flex items-center justify-center", className)}
      style={size ? { width: size, height: size, fontSize: size * 0.7 } : undefined}
    >
      ₱
    </span>
  )
}

// For use in icon arrays (to match lucide-react interface)
export const PesoSign = PesoIcon
