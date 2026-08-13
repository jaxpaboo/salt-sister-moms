import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Project } from '../../models/project';
import { ProjectCardComponent } from '../project-card/project-card.component';

@Component({
  selector: 'app-project-list',
  imports: [CommonModule, ProjectCardComponent],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent {
  @Input({ required: true }) projects: Project[] = [];
  @Input() isAuthenticated = false;
  @Input() emptyMessage = 'No ideas yet. Sign in and tap “+ New Idea” to start one.';
  @Input() showRestore = false;

  @Output() edit = new EventEmitter<Project>();
  @Output() delete = new EventEmitter<Project>();
  @Output() restore = new EventEmitter<Project>();

  trackById = (_: number, project: Project): string => project.project_id;
}