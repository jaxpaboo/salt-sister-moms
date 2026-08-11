import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';

import packageJson from '../../package.json';

import { AppHeaderComponent, DashboardTab } from './components/app-header/app-header.component';
import { LoginModalComponent } from './components/login-modal/login-modal.component';
import { ProjectFormComponent } from './components/project-form/project-form.component';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { ConfirmationToastComponent } from './components/confirmation-toast/confirmation-toast.component';

import { AuthService } from './services/auth.service';
import { ProjectsService } from './services/projects.service';
import { Project } from './models/project';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    AppHeaderComponent,
    LoginModalComponent,
    ProjectFormComponent,
    ProjectListComponent,
    ConfirmationToastComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly appVersion = packageJson.version;

  readonly auth = inject(AuthService);
  readonly projects = inject(ProjectsService);

  readonly tabs: Array<{ label: string; value: DashboardTab }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Archive', value: 'archive' },
  ];

  selectedTab: DashboardTab = 'all';

  showLogin = false;
  loginEmail = '';
  loginPassword = '';
  loginBusy = false;

  showForm = false;
  editingProject: Project | null = null;

  showConfirm = false;
  confirmMessage = '';
  private pendingDeleteId: string | null = null;

  // Side-screen placeholders. The Sponsors / Inspirations tabs fire these so
  // the header isn't a dead control, but the management UIs are a future task.
  // We surface a friendly toast via `confirmMessage` so it doesn't look broken.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private openingSideScreen = '';

  constructor() {
    // effect() must be called inside an injection context — the constructor
    // of an Angular-managed component is one. React to auth flips by loading
    // (or clearing) the dashboard data whenever the user signs in or out.
    effect(() => {
      if (this.auth.isAuthenticated()) {
        void this.projects.refreshAll();
      } else {
        this.projects.projects.set([]);
        this.projects.sponsors.set([]);
        this.projects.inspirations.set([]);
      }
    });
  }

  ngOnInit(): void {
    // Kick off an initial fetch — this resolves whether or not a persisted
    // session was restored by AuthService during construction.
    void this.projects.refreshAll().catch(() => {});
  }

  // Derived: which projects show on the dashboard given the selected tab.
  readonly displayedProjects = computed(() => {
    const all = this.projects.projects();
    switch (this.selectedTab) {
      case 'active':
        return all.filter((p) => p.status !== 'Archive');
      case 'archive':
        return all.filter((p) => p.status === 'Archive');
      case 'all':
      default:
        return all;
    }
  });

  headTitle(): string {
    switch (this.selectedTab) {
      case 'active':
        return 'Active ideas';
      case 'archive':
        return 'Archive';
      default:
        return 'All ideas';
    }
  }

  headSub(): string {
    if (!this.auth.isAuthenticated()) {
      return 'Browse the demo. Sign in to view and edit your ideas.';
    }
    const count = this.displayedProjects().length;
    return `${count} ${count === 1 ? 'idea' : 'ideas'} on this board.`;
  }

  emptyMessage(): string {
    if (!this.auth.isAuthenticated()) {
      return 'Sign in to load your ideas from Firebase.';
    }
    if (this.selectedTab === 'archive') {
      return 'No archived ideas. Mark an idea as “Archive” to tuck it away.';
    }
    return 'No ideas yet. Tap “+ New Idea” to capture one.';
  }

  selectTab(tab: DashboardTab): void {
    this.selectedTab = tab;
  }

  // --- Login flow --------------------------------------------------------

  openLogin(): void {
    this.loginEmail = '';
    this.loginPassword = '';
    this.showLogin = true;
  }

  closeLogin(): void {
    this.showLogin = false;
  }

  async submitLogin(form: NgForm): Promise<void> {
    if (form.invalid) return;
    this.loginBusy = true;
    try {
      await this.auth.signIn(this.loginEmail, this.loginPassword);
      if (this.auth.isAuthenticated()) {
        this.showLogin = false;
      }
    } finally {
      this.loginBusy = false;
    }
  }

  logout(): void {
    this.auth.signOut();
    this.closeForm();
  }

  // --- New / edit / save flow --------------------------------------------

  async openNew(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    const draft = await this.projects.createProject({ idea_title: 'New idea' });
    this.editingProject = draft;
    this.showForm = true;
  }

  openEdit(project: Project): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingProject = project;
    this.showForm = true;
  }

  get isEditing(): boolean {
    return !!this.editingProject && !!(this.editingProject.project_id?.length);
  }

  closeForm(): void {
    this.showForm = false;
    // For new projects we already created a placeholder row; if the user
    // cancels with no title, discard it so the dashboard doesn't litter.
    if (this.editingProject && (this.editingProject.idea_title ?? '').trim() === 'New idea') {
      void this.projects.deleteProject(this.editingProject.project_id);
    }
    this.editingProject = null;
  }

  async onSave(project: Project): Promise<void> {
    if (this.isEditing && this.editingProject) {
      await this.projects.updateProject(this.editingProject.project_id, project);
    } else if (project.project_id) {
      await this.projects.updateProject(project.project_id, project);
    }
    this.showForm = false;
    this.editingProject = null;
  }

  // --- Delete with confirmation ------------------------------------------

  confirmDelete(project: Project): void {
    this.pendingDeleteId = project.project_id;
    this.confirmMessage = `Delete idea ${project.project_id}? This cannot be undone.`;
    this.showConfirm = true;
  }

  async doDelete(): Promise<void> {
    if (this.pendingDeleteId) {
      await this.projects.deleteProject(this.pendingDeleteId);
    }
    this.cancelDelete();
  }

  cancelDelete(): void {
    this.pendingDeleteId = null;
    this.showConfirm = false;
    this.confirmMessage = '';
  }

  async onDelete(project: Project): Promise<void> {
    this.showForm = false;
    this.editingProject = null;
    await this.projects.deleteProject(project.project_id);
  }

  // --- Stub side-screens (Sponsors / Inspirations) -----------------------
  // These are intentional placeholders — added the header entries so the
  // surface area is consistent, but the management screens are a follow-up.

  openSponsors(): void {
    this.showConfirm = true;
    this.confirmMessage = 'Sponsors manager coming soon — wire it up next.';
  }

  openInspirations(): void {
    this.showConfirm = true;
    this.confirmMessage = 'Inspirations manager coming soon — wire it up next.';
  }
}
