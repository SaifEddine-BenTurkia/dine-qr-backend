import {
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../common/auth.guard';
import { SUPPORTED_LOCALES } from '../common/locales';
import { MenuTranslationService } from './menu-translation.service';
import { imageUploadOptions, requireFile } from '../common/image-upload';
import { AiService } from './ai.service';

class TranslateMenuDto {
  @IsIn(SUPPORTED_LOCALES.filter((locale) => locale !== 'fr'))
  locale: string;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly translations: MenuTranslationService,
  ) {}

  @Throttle({ default: { ttl: 60 * 60_000, limit: 20 } })
  @HttpCode(200)
  @Post('translate-menu')
  translateMenu(@CurrentUser() user: AuthUser, @Body() body: TranslateMenuDto) {
    return this.translations.translateMenu(
      user.id,
      body.locale,
      body.overwrite ?? false,
    );
  }

  // Each call costs model quota, so it is limited well below normal browsing.
  @Throttle({ default: { ttl: 60 * 60_000, limit: 10 } })
  @HttpCode(200)
  @Post('menu-import')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async menuImport(@UploadedFile() file: Express.Multer.File | undefined) {
    return { dishes: await this.ai.parseMenuImage(requireFile(file)) };
  }
}
