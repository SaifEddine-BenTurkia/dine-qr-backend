import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { describe } from '../common/http-exception.filter';

export interface LibraryFolder {
  name: string;
  path: string;
}

export interface LibraryImage {
  publicId: string;
  url: string;
}

// Folder names in the shared image library come from Cloudinary itself, but the
// query string is user input, so it is checked before going into a search expression.
const SAFE_FOLDER = /^[\p{L}\p{N} _-]{1,64}$/u;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly configured: boolean;
  private readonly rootFolder: string;
  private readonly libraryFolder: string;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');
    this.configured = Boolean(cloudName && apiKey && apiSecret);
    this.rootFolder = config.get<string>('CLOUDINARY_FOLDER') ?? 'tableqr';
    this.libraryFolder =
      config.get<string>('CLOUDINARY_LIBRARY_FOLDER') ?? 'tableqr-library';

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  /** Uploads an image under the restaurant's own folder and returns its HTTPS URL. */
  async uploadRestaurantImage(
    restaurantId: string,
    kind: 'logo' | 'dishes',
    file: Express.Multer.File,
  ): Promise<string> {
    this.ensureConfigured();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `${this.rootFolder}/${restaurantId}/${kind}`,
          resource_type: 'image',
          // Cap the stored size; menus never need more than this.
          transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        },
        (error, response) => {
          if (error || !response) {
            reject(new Error(error?.message ?? 'Empty Cloudinary response'));
          } else {
            resolve(response);
          }
        },
      );
      stream.end(file.buffer);
    }).catch((error: unknown) => {
      this.logger.error(`Cloudinary upload failed: ${describe(error)}`);
      throw new ServiceUnavailableException("Échec de l'envoi de l'image");
    });
    return result.secure_url;
  }

  async listLibraryFolders(): Promise<LibraryFolder[]> {
    this.ensureConfigured();
    let response: { folders: { name: string; path: string }[] };
    try {
      response = (await cloudinary.api.sub_folders(this.libraryFolder)) as {
        folders: { name: string; path: string }[];
      };
    } catch (error) {
      // No library folder yet is a normal, empty library.
      if (httpCode(error) === 404) return [];
      throw this.libraryUnavailable(error);
    }
    return response.folders
      .map((folder) => ({ name: folder.name, path: folder.path }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  async listLibraryImages(folder: string): Promise<LibraryImage[]> {
    this.ensureConfigured();
    if (!SAFE_FOLDER.test(folder)) {
      throw new BadRequestException('Dossier invalide');
    }
    const path = `${this.libraryFolder}/${folder}`;
    // Accounts on Cloudinary's newer "dynamic folders" mode index assets by
    // asset_folder; older "fixed folders" accounts by folder. Try both.
    for (const field of ['asset_folder', 'folder']) {
      let response: { resources: { public_id: string; secure_url: string }[] };
      try {
        response = (await cloudinary.search
          .expression(`${field}="${path}" AND resource_type:image`)
          .sort_by('public_id', 'asc')
          .max_results(200)
          .execute()) as {
          resources: { public_id: string; secure_url: string }[];
        };
      } catch (error) {
        throw this.libraryUnavailable(error);
      }
      if (response.resources.length > 0) {
        return response.resources.map((resource) => ({
          publicId: resource.public_id,
          url: resource.secure_url,
        }));
      }
    }
    return [];
  }

  private libraryUnavailable(error: unknown) {
    this.logger.error(`Cloudinary library request failed: ${describe(error)}`);
    return new ServiceUnavailableException(
      "La bibliothèque d'images est indisponible",
    );
  }

  private ensureConfigured() {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        "Le stockage d'images n'est pas configuré",
      );
    }
  }
}

// Cloudinary's admin API rejects with { error: { http_code } }, not an Error.
function httpCode(error: unknown): number | undefined {
  const record = error as {
    error?: { http_code?: number };
    http_code?: number;
  };
  return record?.error?.http_code ?? record?.http_code;
}
