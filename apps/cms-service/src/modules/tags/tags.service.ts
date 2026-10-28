import { Injectable } from '@nestjs/common';
import { TagsRepository } from './tags.repository.js';
import { CreateTagDto } from './dto/create-tag.dto.js';
import { UpdateTagDto } from './dto/update-tag.dto.js';

@Injectable()
export class TagsService {
  constructor(private repo: TagsRepository) {}

  create(dto: CreateTagDto) {
    return this.repo.create(dto);
  }

  findAll() {
    return this.repo.findAll();
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  update(id: string, dto: UpdateTagDto) {
    return this.repo.update(id, dto);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
