import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Inspiration } from '../../models/inspiration';

@Component({
  selector: 'app-inspiration-card',
  imports: [CommonModule],
  templateUrl: './inspiration-card.component.html',
  styleUrl: './inspiration-card.component.scss',
})
export class InspirationCardComponent {
  @Input({ required: true }) inspiration!: Inspiration;
  @Input() isAuthenticated = false;

  @Output() edit = new EventEmitter<Inspiration>();
  @Output() delete = new EventEmitter<Inspiration>();

  get thumbnailUrl(): string {
    return this.inspiration.image_link || this.inspiration.video_link || this.inspiration.website_link || '';
  }

  get isVideo(): boolean {
    return !!this.inspiration.video_link && !this.inspiration.image_link;
  }

  get isImage(): boolean {
    return !!this.inspiration.image_link;
  }

  get isWebsite(): boolean {
    return !!this.inspiration.website_link && !this.inspiration.image_link && !this.inspiration.video_link;
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.inspiration);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.inspiration);
  }
}