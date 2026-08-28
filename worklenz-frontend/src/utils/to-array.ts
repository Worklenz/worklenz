/**
 * Safely coerces a value to an array.
 *
 * Async thunks frequently return `response.body`, which can be `undefined` when
 * the API responds with `done: false`, an empty body, or a non-array shape.
 * Calling array methods (`map`, `forEach`, `length`, …) on that `undefined`
 * payload in a reducer throws "can't access property 'map', payload is
 * undefined". Use this helper at the start of such reducers to degrade
 * gracefully to an empty array instead of crashing.
 */
export const toArray = <T>(value: T[] | null | undefined): T[] =>
  Array.isArray(value) ? value : [];
