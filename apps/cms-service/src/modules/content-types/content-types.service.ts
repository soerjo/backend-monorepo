import { Injectable } from '@nestjs/common';
import { ContentTypesRepository } from './content-types.repository.js';
import { CreateContentTypeDto } from './dto/create-content-type.dto.js';
import { UpdateContentTypeDto } from './dto/update-content-type.dto.js';

@Injectable()
export class ContentTypesService {
  constructor(private repo: ContentTypesRepository) {}

  create(dto: CreateContentTypeDto) {
    return this.repo.create(dto);
  }

  findAll() {
    return this.repo.findAll();
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  findByKey(key: string) {
    return this.repo.findByKey(key);
  }

  update(id: string, dto: UpdateContentTypeDto) {
    return this.repo.update(id, dto);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
