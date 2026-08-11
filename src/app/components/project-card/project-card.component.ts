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

  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<Project>();

  Math = Math;

  /** True when the user can still edit / delete (auth and non-archived). */
  get canManage(): boolean {
    return this.isAuthenticated;
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.edit.emit(this.project);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.delete.emit(this.project);
  }
}
