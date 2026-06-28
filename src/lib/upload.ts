// Guardas leves de upload no cliente (mensagens em pt-BR). O limite "de verdade" continua no
// Storage / Edge Function; estas checagens evitam enviar arquivos grandes ou de tipo inválido e
// dão um erro claro ao usuário antes da ida-e-volta à rede.
export const MAX_UPLOAD_MB = 15;

export function assertUploadSize(file: File, maxMB: number = MAX_UPLOAD_MB): void {
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (máximo ${maxMB} MB).`);
  }
}

export function assertImagem(file: File): void {
  // Só valida quando o navegador informou um tipo; flexível para tipos vazios.
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Envie uma imagem (JPG ou PNG).');
  }
}
