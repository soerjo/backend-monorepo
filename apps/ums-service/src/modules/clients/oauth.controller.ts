import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { ClientCredentialsDto } from './dto/client-credentials.dto.js';
import { OauthTokenService } from './oauth-token.service.js';

@ApiTags('OAuth')
@Controller('oauth')
export class OauthController {
  constructor(private readonly oauthTokenService: OauthTokenService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'client_credentials grant issuing a 1-hour M2M access token',
  })
  token(@Body() dto: ClientCredentialsDto) {
    return this.oauthTokenService.issueClientCredentialsToken(dto);
  }
}
