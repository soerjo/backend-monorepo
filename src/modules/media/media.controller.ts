import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { MediaService } from './media.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';

@ApiTags('Media')
@ApiBearerAuth()
@Roles('ums:admin')
@Controller('media')
export class MediaController {
  constructor(private service: MediaService) {}

  @Post()
  @ApiOperation({ summary: 'Upload media asset (multipart)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.service.upload(file, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List media assets' })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const skip = (pageNum - 1) * limitNum;
    return this.service.findAll(skip, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media asset by ID' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete media asset by ID' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
