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

  // Trash view state
  showTrash = false;

  // Search
  searchQuery = signal('');

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

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  // Derived: which projects show on the dashboard given the selected tab.
  readonly displayedProjects = computed(() => {
    const all = this.projects.activeProjects();
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

  // Further filter by search query (typeahead on title, description, id).
  readonly filteredProjects = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.displayedProjects();
    return this.displayedProjects().filter((p) => {
      return (
        p.idea_title.toLowerCase().includes(q) ||
        p.idea_description.toLowerCase().includes(q) ||
        p.project_id.toLowerCase().includes(q)
      );
    });
  });

  headTitle(): string {
    if (this.showTrash) {
      return 'Trash';
    }
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
    if (this.showTrash) {
      const count = this.projects.trashedProjects().length;
      return `${count} ${count === 1 ? 'idea' : 'ideas'} in the trash.`;
    }
    if (!this.auth.isAuthenticated()) {
      return 'Browse the demo. Sign in to view and edit your ideas.';
    }
    const count = this.filteredProjects().length;
    return `${count} ${count === 1 ? 'idea' : 'ideas'} on this board.`;
  }

  emptyMessage(): string {
    if (this.showTrash) {
      return 'Trash is empty.';
    }
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
    this.showTrash = false;
    this.searchQuery.set('');
  }

  // --- Trash view ---------------------------------------------------------

  openTrash(): void {
    this.showTrash = true;
    this.searchQuery.set('');
  }

  closeTrash(): void {
    this.showTrash = false;
  }

  async restoreProject(project: Project): Promise<void> {
    await this.projects.restoreProject(project.project_id);
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

  // Open the form with no model. The row isn't created in Firebase until
  // the user clicks Save — that way the Delete button can stay hidden
  // until the project actually exists.
  openNew(): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingProject = null;
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
    this.editingProject = null;
  }

  async onSave(project: Project): Promise<void> {
    if (this.editingProject && this.editingProject.project_id) {
      // Existing project — update in place.
      await this.projects.updateProject(this.editingProject.project_id, project);
    } else {
      // Brand-new project — first save creates the row.
      const created = await this.projects.createProject(project);
      this.editingProject = created;
    }
    this.showForm = false;
    this.editingProject = null;
  }

  // --- Delete with confirmation ------------------------------------------

  confirmDelete(project: Project): void {
    this.pendingDeleteId = project.project_id;
    this.confirmMessage = `Move idea <b>${project.idea_title}</b> to trash?<br><br><i>You can restore it later from the Trash view.</i>`;
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
    // Close the form first; reuse the same confirmation flow as the card
    // delete. If the user cancels, the project stays put.
    this.showForm = false;
    this.editingProject = null;
    this.confirmDelete(project);
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