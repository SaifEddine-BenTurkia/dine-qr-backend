import {
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/auth.guard';
import { imageUploadOptions, requireFile } from '../common/image-upload';
import { AiService } from './ai.service';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  // Each call costs model quota, so it is limited well below normal browsing.
  @Throttle({ default: { ttl: 60 * 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('menu-import')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async menuImport(@UploadedFile() file: Express.Multer.File | undefined) {
    return { dishes: await this.ai.parseMenuImage(requireFile(file)) };
  }
}
