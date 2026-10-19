import { PartialType } from '@nestjs/swagger';
import { CreateIdentityProviderDto } from './create-identity-provider.dto.js';

export class UpdateIdentityProviderDto extends PartialType(CreateIdentityProviderDto) {}
