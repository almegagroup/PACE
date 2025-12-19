export const ENV = {
  API_BASE: import.meta.env.VITE_API_BASE,
};

if (!ENV.API_BASE) {
  throw new Error('[ENV] VITE_API_BASE missing');
}