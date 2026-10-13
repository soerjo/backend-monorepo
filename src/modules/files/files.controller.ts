import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { FilesService } from './files.service.js';
import { MAX_FILE_SIZE_BYTES } from './files.constants.js';
import { ListFilesQueryDto } from './dto/list-files-query.dto.js';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.filesService.upload(file, user);
  }

  @Get()
  list(@Query() query: ListFilesQueryDto, @CurrentUser() user: AuthUser) {
    return this.filesService.list(query, user);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.getById(id, user);
  }

  @Get(':id/url')
  getPresignedUrl(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.getPresignedUrl(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.remove(id, user);
  }
}
