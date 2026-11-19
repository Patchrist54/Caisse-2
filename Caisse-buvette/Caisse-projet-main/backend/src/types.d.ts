declare module 'qrcode-terminal' {
  export function generate(texte: string, options?: { small?: boolean }, cb?: (qr: string) => void): void;
}
