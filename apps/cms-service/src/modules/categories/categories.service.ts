import { Injectable } from '@nestjs/common';
import { CategoriesRepository } from './categories.repository.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private repo: CategoriesRepository) {}

  create(dto: CreateCategoryDto) {
    return this.repo.create(dto);
  }

  findAll() {
    return this.repo.findAll();
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  update(id: string, dto: UpdateCategoryDto) {
    return this.repo.update(id, dto);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }
}
