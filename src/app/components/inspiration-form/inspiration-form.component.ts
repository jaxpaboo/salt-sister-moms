import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { Inspiration } from '../../models/inspiration';
import { buildYoutubeEmbedUrl } from '../../utils/youtube';
import { preventEnterSubmit } from '../../utils/forms';

@Component({
  selector: 'app-inspiration-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './inspiration-form.component.html',
  styleUrl: './inspiration-form.component.scss',
})
export class InspirationFormComponent implements OnChanges {
  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;

  readonly preventEnterSubmit = preventEnterSubmit;

  @Input() visible = false;
  @Input() model: Inspiration | null = null;
  @Input() isEditing = false;

  @Output() save = new EventEmitter<Inspiration>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<Inspiration>();
  /** Emitted instead of `cancel` when the user tries to close a dirty form —
   *  the parent is expected to confirm before actually closing. */
  @Output() unsavedClose = new EventEmitter<void>();

  draft: Inspiration = this.blank();

  // Snapshot of `draft` as of the last time the form was (re)opened, used to
  // detect unsaved edits when the user tries to close it.
  private originalSnapshot = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['visible'] || changes['isEditing']) {
      this.draft = this.clone(this.model) ?? this.blank();
      if (this.visible && !this.isEditing) {
        window.setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
      }
      this.originalSnapshot = JSON.stringify(this.draft);
    }
  }

  /** True when the draft has changed since the form was opened. */
  private isDirty(): boolean {
    return JSON.stringify(this.draft) !== this.originalSnapshot;
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    const videoLink = (this.draft.video_link ?? '').trim();
    const cleaned: Inspiration = {
      ...this.draft,
      name: (this.draft.name ?? '').trim(),
      image_link: (this.draft.image_link ?? '').trim(),
      video_link: videoLink,
      video_link_embedded: buildYoutubeEmbedUrl(videoLink) ?? '',
      website_link: (this.draft.website_link ?? '').trim(),
      comments: (this.draft.comments ?? '').trim(),
      materials: (this.draft.materials ?? '').trim(),
    };
    this.save.emit(cleaned);
  }

  onCancel(): void {
    if (this.isDirty()) {
      this.unsavedClose.emit();
      return;
    }
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.model) {
      this.delete.emit(this.model);
    }
  }

  private blank(): Inspiration {
    return {
      inspiration_id: '',
      name: '',
      image_link: '',
      video_link: '',
      website_link: '',
      comments: '',
      materials: '',
      video_link_embedded: '',
    };
  }

  private clone(model: Inspiration | null): Inspiration | null {
    if (!model) return null;
    return { ...model };
  }
}