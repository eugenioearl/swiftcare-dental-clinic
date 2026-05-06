

// Currency formatting utility for Philippine Peso
export function formatCurrency(
  amount: number | string | null | undefined, 
  options: { 
    showSymbol?: boolean
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  } = {}
): string {
  const {
    showSymbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2
  } = options

  // Handle null/undefined/empty values
  if (amount === null || amount === undefined || amount === '') {
    return showSymbol ? '₱0.00' : '0.00'
  }

  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  
  // Handle invalid numbers
  if (isNaN(numAmount)) {
    return showSymbol ? '₱0.00' : '0.00'
  }

  // Format the number
  const formatted = new Intl.NumberFormat('en-PH', {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(numAmount)

  return showSymbol ? `₱${formatted}` : formatted
}

// Parse currency string to number (removes ₱ symbol and commas)
export function parseCurrency(currencyString: string): number {
  if (!currencyString) return 0
  
  // Remove ₱ symbol, commas, and whitespace
  const cleanString = currencyString.replace(/[₱,$\s]/g, '')
  const parsed = parseFloat(cleanString)
  
  return isNaN(parsed) ? 0 : parsed
}

// Convert USD to PHP (mock conversion rate - in real app, use live rates)
export function convertUsdToPhp(usdAmount: number, exchangeRate: number = 56.50): number {
  return usdAmount * exchangeRate
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Format large numbers with suffixes (K, M, B)
export function formatLargeNumber(num: number): string {
  if (num >= 1e9) {
    return `₱${(num / 1e9).toFixed(1)}B`
  } else if (num >= 1e6) {
    return `₱${(num / 1e6).toFixed(1)}M`
  } else if (num >= 1e3) {
    return `₱${(num / 1e3).toFixed(1)}K`
  }
  return formatCurrency(num)
}

// Validate currency input
export function isValidCurrency(value: string): boolean {
  const cleanValue = value.replace(/[₱,$\s]/g, '')
  return !isNaN(parseFloat(cleanValue)) && isFinite(parseFloat(cleanValue))
}
