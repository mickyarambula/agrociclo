/** Serializa trabajo por clave. Espejo JS de SELECT … FOR UPDATE (un hilo por disposición). */
const chains = new Map();

/**
 * @template T
 * @param {string} key
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export function serialize(key, fn) {
  const prev = chains.get(key) ?? Promise.resolve();
  const next = prev.then(
    () => fn(),
    () => fn(),
  );
  chains.set(
    key,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
