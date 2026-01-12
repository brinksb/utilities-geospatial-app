import { toast } from 'sonner'

/**
 * Simpsons-themed toast notifications for Springfield Utilities.
 * Each action gets its own iconic feedback.
 */
export const showToast = {
  success: (message: string) =>
    toast.success(message, {
      icon: '🍩',
    }),

  error: (message: string) =>
    toast.error(message, {
      icon: '💥',
    }),

  info: (message: string) =>
    toast(message, {
      icon: '📋',
    }),

  network: (edgeCount: number) =>
    toast.success(`Network traced: ${edgeCount} connected edges`, {
      icon: '🔌',
    }),

  outage: (buildingCount: number) =>
    toast(`Outage impact: ${buildingCount} buildings affected`, {
      icon: '⚠️',
      style: {
        background: '#FF6347',
        color: '#fff',
        border: '2px solid #8B0000',
      },
    }),

  pipeSelected: (pipeId: number, pipeClass: string) =>
    toast(`Inspecting ${pipeClass} pipe #${pipeId}`, {
      icon: '🔍',
    }),

  spread: (maxHops: number, edgeCount: number) =>
    toast.success(`Spread simulation: ${edgeCount} edges over ${maxHops} hops`, {
      icon: '🌊',
    }),

  loading: (message: string) =>
    toast.loading(message, {
      icon: '⏳',
    }),

  worstDay: (buildingCount: number, message: string) =>
    toast(message, {
      icon: '☢️',
      duration: 8000,
      style: {
        background: '#8B0000',
        color: '#FED90F',
        border: '3px solid #FED90F',
        fontWeight: 'bold',
        fontSize: '14px',
      },
    }),
}
