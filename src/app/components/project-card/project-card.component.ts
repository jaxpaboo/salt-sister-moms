import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Project } from '../../models/project';

@Component({
  selector: 'app-project-card',
  imports: [CommonModule],
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
})
export class ProjectCardComponent {
  @Input({ required: true }) project!: Project;
  @Input() isAuthenticated = false;
  @Input() showRestore = false;

  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<Project>();
  @Output() restore = new EventEmitter<Project>();

  Math = Math;

  /** True when the user can still edit / delete (auth and non-archived). */
  get canManage(): boolean {
    return this.isAuthenticated;
  }

  // project_id is YYYYMMDDnnn, generated once at creation and never
  // changed on edit — so its date prefix doubles as the created date.
  get createdDate(): string {
    const id = this.project.project_id || '';
    const match = id.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!match) return '';
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  get checklistTotal(): number {
    return this.project.checklist?.length || 0;
  }

  get checklistDone(): number {
    return this.project.checklist?.filter((item) => item.done).length || 0;
  }

  get checklistPct(): number {
    return this.checklistTotal ? Math.round((this.checklistDone / this.checklistTotal) * 100) : 0;
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.project);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.project);
  }

  onRestore(event: MouseEvent): void {
    event.stopPropagation();
    this.restore.emit(this.project);
  }
}