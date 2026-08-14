import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';

import { Sponsor } from '../../models/sponsor';

@Component({
  selector: 'app-sponsor-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './sponsor-form.component.html',
  styleUrl: './sponsor-form.component.scss',
})
export class SponsorFormComponent implements OnChanges {
  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;

  @Input() visible = false;
  @Input() model: Sponsor | null = null;
  @Input() isEditing = false;

  @Output() save = new EventEmitter<Sponsor>();
  @Output() cancel = new EventEmitter<void>();
  @Output() delete = new EventEmitter<Sponsor>();

  draft: Sponsor = this.blank();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['model'] || changes['visible'] || changes['isEditing']) {
      this.draft = this.clone(this.model) ?? this.blank();
      if (this.visible && !this.isEditing) {
        window.setTimeout(() => this.nameInput?.nativeElement.focus(), 0);
      }
    }
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    const cleaned: Sponsor = {
      ...this.draft,
      name: (this.draft.name ?? '').trim(),
      product: (this.draft.product ?? '').trim(),
      description: (this.draft.description ?? '').trim(),
      contact: (this.draft.contact ?? '').trim(),
      email: (this.draft.email ?? '').trim(),
      phone_number: (this.draft.phone_number ?? '').trim(),
    };
    this.save.emit(cleaned);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDelete(): void {
    if (this.model) {
      this.delete.emit(this.model);
    }
  }

  private blank(): Sponsor {
    return {
      sponsor_id: '',
      name: '',
      description: '',
      contact: '',
      email: '',
      phone_number: '',
      product: '',
    };
  }

  private clone(model: Sponsor | null): Sponsor | null {
    if (!model) return null;
    return { ...model };
  }
}