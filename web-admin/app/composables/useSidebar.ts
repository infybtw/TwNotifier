export function useSidebar() {
  const collapsed = useState('sidebar', () => false)

  function toggle() {
    collapsed.value = !collapsed.value
    if (import.meta.client) {
      localStorage.setItem('sidebar', collapsed.value ? 'collapsed' : 'expanded')
    }
  }

  function init() {
    if (import.meta.client) {
      collapsed.value = localStorage.getItem('sidebar') === 'collapsed'
    }
  }

  return { collapsed, toggle, init }
}
