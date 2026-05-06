
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { formatCurrency } from "@/lib/currency"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
  }
  isCurrency?: boolean
  formatter?: (value: string | number) => string
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  isCurrency = false,
  formatter 
}: StatsCardProps) {
  // Format the value
  let displayValue: string
  
  if (formatter) {
    displayValue = formatter(value)
  } else if (isCurrency && typeof value === 'number') {
    displayValue = formatCurrency(value)
  } else {
    displayValue = String(value)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        {trend && (
          <p className="text-xs text-muted-foreground">
            <span className={trend.value > 0 ? "text-green-600" : "text-red-600"}>
              {trend.value > 0 ? "+" : ""}{trend.value}%
            </span>{" "}
            {trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
