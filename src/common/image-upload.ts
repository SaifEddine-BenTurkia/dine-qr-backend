import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

const allowedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Kept in memory and streamed straight to Cloudinary; nothing touches the disk.
export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(
        new BadRequestException('Format accepté : JPEG, PNG, WebP ou GIF'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

export function requireFile(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  if (!file) {
    throw new BadRequestException('Aucun fichier reçu (champ "file")');
  }
  return file;
}
