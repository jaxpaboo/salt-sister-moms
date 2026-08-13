import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DashboardTab = 'all' | 'active' | 'archive';

@Component({
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  @Input() isAuthenticated = false;
  @Input() email = '';
  @Input() selectedTab: DashboardTab = 'all';
  @Input() tabs: Array<{ label: string; value: DashboardTab }> = [];
  @Input() version = '0.0.0';
  @Input() showTrashTab = false;

  @Output() loginClick = new EventEmitter<void>();
  @Output() logoutClick = new EventEmitter<void>();
  @Output() newProjectClick = new EventEmitter<void>();
  @Output() tabSelected = new EventEmitter<DashboardTab>();
  @Output() sponsorsClick = new EventEmitter<void>();
  @Output() inspirationsClick = new EventEmitter<void>();
  @Output() trashClick = new EventEmitter<void>();

  settingsOpen = false;

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  closeSettings(): void {
    this.settingsOpen = false;
  }

  onLogout(): void {
    this.closeSettings();
    this.logoutClick.emit();
  }

  onTrash(): void {
    this.closeSettings();
    this.trashClick.emit();
  }
}