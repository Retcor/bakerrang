module.exports = {
  theme: {
    extend: {
      colors: {
        gold: 'var(--gold)',
        ink: 'var(--ink)',
        muted: 'var(--ink-2)',
        ground: 'var(--bg)',
        plane: 'var(--plane)'
      },
      borderRadius: {
        control: 'var(--radius-control)',
        panel: 'var(--radius-panel)'
      },
      boxShadow: {
        resting: 'var(--shadow-resting)',
        contact: 'var(--shadow-contact)'
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        display: ['Archivo Expanded', 'Archivo', 'sans-serif']
      }
    }
  }
}
