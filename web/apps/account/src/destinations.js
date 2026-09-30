import { resolveDestinations } from '@bakerrang/web-app-shell'

// Navigation ownership is the shared registry's: Account adds no destinations of its own.
export const destinations = resolveDestinations(import.meta.env)
export const passwordsUrl = destinations.tools.find((tool) => tool.id === 'passwords').url
