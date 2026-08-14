import { Component, OnInit, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Inspiration } from '../../models/inspiration';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-inspiration-card',
  imports: [CommonModule],
  templateUrl: './inspiration-card.component.html',
  styleUrl: './inspiration-card.component.scss',
})
export class InspirationCardComponent implements OnInit {
  @Input({ required: true }) inspiration!: Inspiration;
  @Input() isAuthenticated = false;

  @Output() edit = new EventEmitter<Inspiration>();
  @Output() delete = new EventEmitter<Inspiration>();

  youtubeEmbedUrl!: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.youtubeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      this.inspiration.video_link_embedded || this.inspiration.video_link || ''
    );
  }

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