import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../common/auth.guard';
import { MediaService } from './media.service';

class LibraryImagesQuery {
  @IsString()
  @MaxLength(64)
  folder: string;
}

// Shared stock photos (drinks, pizzas, desserts...) restaurants can pick from.
@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly media: MediaService) {}

  @Get('folders')
  folders() {
    return this.media.listLibraryFolders();
  }

  @Get('images')
  images(@Query() query: LibraryImagesQuery) {
    return this.media.listLibraryImages(query.folder);
  }
}
