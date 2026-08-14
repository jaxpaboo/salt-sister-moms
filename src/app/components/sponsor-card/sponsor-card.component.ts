import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Sponsor } from '../../models/sponsor';

@Component({
  selector: 'app-sponsor-card',
  imports: [CommonModule],
  templateUrl: './sponsor-card.component.html',
  styleUrl: './sponsor-card.component.scss',
})
export class SponsorCardComponent {
  @Input({ required: true }) sponsor!: Sponsor;
  @Input() isAuthenticated = false;

  @Output() edit = new EventEmitter<Sponsor>();
  @Output() delete = new EventEmitter<Sponsor>();

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.sponsor);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.sponsor);
  }
}