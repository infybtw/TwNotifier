export function formatTimeForAdmin(isoString: string, utcOffset: number): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  date.setUTCHours(date.getUTCHours() + utcOffset)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const seconds = String(date.getUTCSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function formatTimeUTC(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  const seconds = String(date.getUTCSeconds()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

export function formatDateForAdmin(isoString: string, utcOffset: number): string {
  return formatTimeForAdmin(isoString, utcOffset).slice(0, 10)
}

export function formatDateUTC(isoString: string): string {
  return formatTimeUTC(isoString).slice(0, 10)
}
