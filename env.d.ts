declare module '@env' {
  export const PINATA_API_KEY: string;
  export const PINATA_API_SECRET: string;
  export const PINATA_JWT: string;
  export const PINATA_URL: string;
  export const EXPO_PUBLIC_LYRIA_API_KEY: string;
}

// Global polyfill declarations
declare global {
  var Buffer: typeof import('buffer').Buffer;
  var process: typeof import('process');
}