import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { MfaService } from './mfa.service.js';
import {
  MfaConfirmDto,
  MfaDisableDto,
  MfaChallengeDto,
} from './dto/mfa.dto.js';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('enroll')
  @HttpCode(200)
  async enroll(@CurrentUser('id') userId: string) {
    return this.mfaService.enroll(userId);
  }

  @Post('confirm')
  @HttpCode(200)
  async confirm(@CurrentUser('id') userId: string, @Body() dto: MfaConfirmDto) {
    return this.mfaService.confirm(userId, dto.code);
  }

  @Post('disable')
  @HttpCode(200)
  async disable(@CurrentUser('id') userId: string, @Body() dto: MfaDisableDto) {
    await this.mfaService.disable(userId, dto.password);
    return { disabled: true };
  }

  @Post('challenge')
  @HttpCode(200)
  @Public()
  async challenge(@Body() dto: MfaChallengeDto, @Req() req: Request) {
    const { userId } = await this.mfaService.verifyChallenge(
      dto.challengeId,
      dto.code,
    );
    const ip = req.ip;
    const userAgent = req.get('user-agent') ?? undefined;
    return this.mfaService.issueTokensAfterChallenge(userId, ip, userAgent);
  }
}
