import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { buildJwks } from '../../common/utils/jwk.util.js';
import { JwtKeysService } from './jwt-keys.service.js';

@ApiTags('Auth')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwtKeys: JwtKeysService) {}

  @Public()
  @Get('jwks.json')
  @ApiOperation({
    summary: 'Public RSA key (JWKS) for local token verification',
  })
  @ApiOkResponse({ description: 'RFC 7517 JWKS document' })
  // Written directly so the document keeps its standard `{ keys: [...] }`
  // shape instead of being wrapped by the global response interceptor.
  jwks(@Res() res: Response): void {
    res.json(buildJwks(this.jwtKeys.publicKey));
  }
}
