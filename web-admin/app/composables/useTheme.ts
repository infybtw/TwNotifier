export function useTheme() {
  const isDark = useState('theme', () => false)

  function toggle() {
    isDark.value = !isDark.value
    apply()
  }

  function apply() {
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', isDark.value)
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    }
  }

  function init() {
    if (import.meta.client) {
      const saved = localStorage.getItem('theme')
      isDark.value = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
      apply()
    }
  }

  return { isDark, toggle, init }
}
