// backend/src/reseau.ts — affiche les adresses à ouvrir sur téléphone/tablette (+ QR code)
import os from 'os';
import qrcode from 'qrcode-terminal';

export function adressesLocales(): string[] {
  const ips: string[] = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const i of interfaces ?? []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
    }
  }
  return ips;
}

export function afficherAccesMobile(port: number, libelle: string): void {
  const ips = adressesLocales();
  console.log(`\n📱 ${libelle}`);
  console.log(`   Sur ce PC        : http://localhost:${port}`);
  if (ips.length === 0) {
    console.log('   (aucune interface réseau détectée)');
    return;
  }
  for (const ip of ips) console.log(`   Sur le Wi-Fi     : http://${ip}:${port}`);
  console.log('   Scannez avec l’appareil photo du téléphone (même réseau Wi-Fi) :');
  qrcode.generate(`http://${ips[0]}:${port}`, { small: true });
}
