# Claude Code Session Notes - Bakerrang Project

## Project Overview
Full-stack learning playground with React frontend and Express backend. Features include:
- Polyglot language learning tools with speech-to-text
- Voice cloning and text-to-speech capabilities
- Supermarket shopping list management
- Story generation tools
- Google OAuth authentication

## Recent Major Updates (2025-09-14)

### Theme System Implementation ✅
- **Added comprehensive dark/light mode** with glassmorphism styling
- **Theme toggle** located in user dropdown (MainContent.jsx)
- **ThemeProvider.jsx** - React context for theme management
- **localStorage persistence** - theme persists across sessions
- **Glassmorphism CSS classes** added to index.css

### Key Files Modified
- `client/src/providers/ThemeProvider.jsx` - Core theme management
- `client/src/App.jsx` - Wrapped with ThemeProvider
- `client/src/MainContent.jsx` - Added theme toggle to user dropdown
- `client/src/index.css` - Added glassmorphism CSS classes
- All page and component files updated for theme support

### CSS Classes Available
```css
/* Glassmorphism backgrounds */
.glass-light, .glass-dark
.glass-card-light, .glass-card-dark
.glass-hover-light, .glass-hover-dark

/* Theme backgrounds */
.light-theme-bg, .dark-theme-bg

/* Theme text colors */
.text-theme-light, .text-theme-dark
.text-theme-secondary-light, .text-theme-secondary-dark
```

### Component Architecture
- All components use `useTheme()` hook
- Consistent glassmorphism styling patterns
- Material Tailwind dependencies removed and replaced
- Proper z-index hierarchy (z-50 dropdowns, z-40 nav, z-10 content)

### Fixed Issues
- ✅ Dropdown z-index problems (appearing behind content)
- ✅ PolyglotInstant microphone loading indicator bug
- ✅ Material Tailwind Alert/Button replacements
- ✅ Prop passing consistency across components

## Development Commands
```bash
# Client development
cd client && npm run dev

# Linting (if available)
npm run lint

# Type checking (if available)
npm run typecheck
```

## Git Status Reference
- Main branch: `main`
- Recent work focused on voice recording features and UI improvements
- All theme changes ready for commit when requested

## Notes for Future Sessions
- Theme system is complete and fully functional
- All 24+ components support dark/light modes
- Glassmorphism effects work across all UI elements
- Material Tailwind dependency has been removed
- Z-index issues have been resolved
- No outstanding theme-related bugs

## Component Patterns
When updating components:
1. Import `useTheme` from `../providers/ThemeProvider.jsx`
2. Use `const { isDark } = useTheme()`
3. Apply conditional glass classes: `${isDark ? 'glass-dark' : 'glass-light'}`
4. Use theme text colors: `${isDark ? 'text-theme-dark' : 'text-theme-light'}`
5. Add transition classes for smooth theme switching

## Architecture Notes
- React 18 with Vite build system
- StandardJS linting rules
- Component-based architecture with shared utilities
- Context providers for app state and theme management