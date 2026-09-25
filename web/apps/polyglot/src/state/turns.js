export const appendTurn = (turns, turn) => [...turns, turn].slice(-50)
export const updateTurn = (turns, id, update) => turns.map((turn) => turn.id === id ? { ...turn, ...(typeof update === 'function' ? update(turn) : update) } : turn)
export const removeTurn = (turns, id) => turns.filter((turn) => turn.id !== id)
export const findTurn = (turns, id) => turns.find((turn) => turn.id === id)

export const nextTurnIdentity = (idCounter, displayCounter) => ({
  id: globalThis.crypto?.randomUUID?.() || `t${++idCounter.current}`,
  n: ++displayCounter.current
})
