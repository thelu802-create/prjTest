export function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export function getCurrentMonthInputValue() {
  return getMonthInputValue(getTodayInputValue())
}

export function getMonthInputValue(value: string) {
  return value.slice(0, 7)
}

export function formatMemoryDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatMonthLabel(value: string) {
  const [year, month] = value.split('-').map(Number)

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}
