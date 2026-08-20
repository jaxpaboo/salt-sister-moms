import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import packageJson from '../../package.json';

import { AppHeaderComponent, MainTab, TabConfig } from './components/app-header/app-header.component';
import { LoginModalComponent } from './components/login-modal/login-modal.component';
import { ProjectFormComponent } from './components/project-form/project-form.component';
import { ProjectListComponent } from './components/project-list/project-list.component';
import { InspirationCardComponent } from './components/inspiration-card/inspiration-card.component';
import { InspirationFormComponent } from './components/inspiration-form/inspiration-form.component';
import { SponsorCardComponent } from './components/sponsor-card/sponsor-card.component';
import { SponsorFormComponent } from './components/sponsor-form/sponsor-form.component';
import { ConfigurationFormComponent } from './components/configuration-form/configuration-form.component';
import { ConfirmationToastComponent } from './components/confirmation-toast/confirmation-toast.component';

import { AuthService } from './services/auth.service';
import { ProjectsService } from './services/projects.service';
import { Project } from './models/project';
import { Inspiration } from './models/inspiration';
import { Sponsor } from './models/sponsor';
import { Configuration } from './models/configuration';

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
    InspirationCardComponent,
    InspirationFormComponent,
    SponsorCardComponent,
    SponsorFormComponent,
    ConfigurationFormComponent,
    ConfirmationToastComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly appVersion = packageJson.version;

  readonly auth = inject(AuthService);
  readonly projects = inject(ProjectsService);
  private readonly router = inject(Router);

  /** Tab inferred from the current URL. 'trash' is a sentinel so the
   *  primary tabs (Projects / Inspirations / Sponsors) all render
   *  unselected when the trash URL is active. */
  mainTab: MainTab = 'projects';

  readonly tabs: TabConfig[] = [
    { label: 'Projects', value: 'projects' },
    { label: 'Inspirations', value: 'inspirations' },
    { label: 'Sponsors', value: 'sponsors' },
  ];

  showLogin = false;
  loginEmail = '';
  loginPassword = '';
  loginBusy = false;

  showForm = false;
  editingProject: Project | null = null;

  showInspirationForm = false;
  editingInspiration: Inspiration | null = null;
  isEditingInspiration = false;

  showSponsorForm = false;
  editingSponsor: Sponsor | null = null;
  isEditingSponsor = false;

  showConfigurationForm = false;
  editingConfiguration: Configuration | null = null;

  showConfirm = false;
  confirmMessage = '';
  private pendingDeleteId: string | null = null;
  private pendingDeleteType: 'project' | 'inspiration' | 'sponsor' | 'configuration' = 'project';

  // Trash view state
  showTrash = false;

  // Search
  searchQuery = signal('');

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
        this.projects.configurations.set([]);
      }
    });

    // Keep mainTab in sync with the URL so deep links (and back/forward
    // navigation) land on the right section.
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.syncTabFromUrl(e.urlAfterRedirects));
    this.syncTabFromUrl(this.router.url);
  }

  ngOnInit(): void {
    // Kick off an initial fetch — this resolves whether or not a persisted
    // session was restored by AuthService during construction.
    void this.projects.refreshAll().catch(() => {});
  }

  /** Read the section from the URL path. Falls back to 'projects'. */
  private syncTabFromUrl(url: string): void {
    const path = (url.split('?')[0] ?? '/').toLowerCase();
    if (path.startsWith('/trash')) {
      this.mainTab = 'trash';
      this.showTrash = true;
      this.searchQuery.set('');
    } else if (path.startsWith('/inspirations')) {
      this.mainTab = 'inspirations';
      this.showTrash = false;
    } else if (path.startsWith('/sponsors')) {
      this.mainTab = 'sponsors';
      this.showTrash = false;
    } else {
      this.mainTab = 'projects';
      this.showTrash = false;
    }
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  trackInspirationById = (_: number, inspiration: Inspiration): string => inspiration.inspiration_id;
  trackSponsorById = (_: number, sponsor: Sponsor): string => sponsor.sponsor_id;

  // Derived: which projects show on the dashboard.
  readonly displayedProjects = computed(() => this.projects.activeProjects());

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

  // Derived: filtered inspirations for search.
  readonly filteredInspirations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.projects.inspirations();
    return this.projects.inspirations().filter((i) => {
      return (
        i.name.toLowerCase().includes(q) ||
        i.comments.toLowerCase().includes(q) ||
        i.materials.toLowerCase().includes(q)
      );
    });
  });

  headTitle(): string {
    if (this.showTrash) {
      return 'Trash';
    }
    switch (this.mainTab) {
      case 'projects':
        return 'All ideas';
      case 'inspirations':
        return 'Inspirations';
      case 'sponsors':
        return 'Sponsors';
      default:
        return 'Salty Ideas';
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
    if (this.mainTab === 'projects') {
      const count = this.filteredProjects().length;
      return `${count} ${count === 1 ? 'idea' : 'ideas'} on this board.`;
    }
    if (this.mainTab === 'inspirations') {
      const count = this.filteredInspirations().length;
      return `${count} ${count === 1 ? 'inspiration' : 'inspirations'} saved.`;
    }
    if (this.mainTab === 'sponsors') {
      const count = this.projects.sponsors().length;
      return `${count} ${count === 1 ? 'sponsor' : 'sponsors'} listed.`;
    }
    return 'Coming soon.';
  }

  emptyMessage(): string {
    if (this.showTrash) {
      return 'Trash is empty.';
    }
    if (!this.auth.isAuthenticated()) {
      return 'Sign in to load your ideas from Firebase.';
    }
    if (this.mainTab === 'projects') {
      return 'No ideas yet. Tap “+ New Idea” to capture one.';
    }
    if (this.mainTab === 'inspirations') {
      return 'No inspirations yet. Tap “+ New Inspiration” to add one.';
    }
    if (this.mainTab === 'sponsors') {
      return 'No sponsors yet. Tap “+ New Sponsor” to add one.';
    }
    return 'Coming soon.';
  }

  selectMainTab(tab: MainTab): void {
    this.mainTab = tab;
    this.showTrash = false;
    this.searchQuery.set('');
    void this.router.navigateByUrl(`/${tab}`);
  }

  // --- Trash view ---------------------------------------------------------

  openTrash(): void {
    this.showTrash = true;
    this.searchQuery.set('');
    void this.router.navigateByUrl('/trash');
  }

  closeTrash(): void {
    this.showTrash = false;
    void this.router.navigateByUrl('/projects');
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

  // --- New / edit / save flow (Projects) ---------------------------------

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

  // --- New / edit / save flow (Inspirations) -----------------------------

  openNewInspiration(): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingInspiration = null;
    this.isEditingInspiration = false;
    this.showInspirationForm = true;
  }

  openEditInspiration(inspiration: Inspiration): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingInspiration = inspiration;
    this.isEditingInspiration = true;
    this.showInspirationForm = true;
  }

  closeInspirationForm(): void {
    this.showInspirationForm = false;
    this.editingInspiration = null;
    this.isEditingInspiration = false;
  }

  async onSaveInspiration(inspiration: Inspiration): Promise<void> {
    if (inspiration.inspiration_id) {
      // Existing inspiration — update in place.
      await this.projects.updateInspiration(inspiration.inspiration_id, inspiration);
    } else {
      // Brand-new inspiration — create a new document.
      const created = await this.projects.createInspiration(inspiration);
      this.editingInspiration = created;
    }
    this.showInspirationForm = false;
    this.editingInspiration = null;
    this.isEditingInspiration = false;
  }

  async onDeleteInspiration(inspiration: Inspiration): Promise<void> {
    this.showInspirationForm = false;
    this.editingInspiration = null;
    this.pendingDeleteId = inspiration.inspiration_id;
    this.pendingDeleteType = 'inspiration';
    this.confirmMessage = `Delete inspiration <b>${inspiration.name}</b>?<br><br><i>This cannot be undone.</i>`;
    this.showConfirm = true;
  }

  // --- New / edit / save flow (Sponsors) ---------------------------------

  openNewSponsor(): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingSponsor = null;
    this.isEditingSponsor = false;
    this.showSponsorForm = true;
  }

  openEditSponsor(sponsor: Sponsor): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingSponsor = sponsor;
    this.isEditingSponsor = true;
    this.showSponsorForm = true;
  }

  closeSponsorForm(): void {
    this.showSponsorForm = false;
    this.editingSponsor = null;
    this.isEditingSponsor = false;
  }

  async onSaveSponsor(sponsor: Sponsor): Promise<void> {
    if (sponsor.sponsor_id) {
      // Existing sponsor — update in place.
      await this.projects.updateSponsor(sponsor.sponsor_id, sponsor);
    } else {
      // Brand-new sponsor — create a new document.
      const created = await this.projects.createSponsor(sponsor);
      this.editingSponsor = created;
    }
    this.showSponsorForm = false;
    this.editingSponsor = null;
    this.isEditingSponsor = false;
  }

  async onDeleteSponsor(sponsor: Sponsor): Promise<void> {
    this.showSponsorForm = false;
    this.editingSponsor = null;
    this.pendingDeleteId = sponsor.sponsor_id;
    this.pendingDeleteType = 'sponsor';
    this.confirmMessage = `Delete sponsor <b>${sponsor.name}</b>?<br><br><i>This cannot be undone.</i>`;
    this.showConfirm = true;
  }

  // --- Configuration flow ------------------------------------------------

  openConfiguration(): void {
    if (!this.auth.isAuthenticated()) {
      this.openLogin();
      return;
    }
    this.editingConfiguration = null;
    this.showConfigurationForm = true;
  }

  closeConfigurationForm(): void {
    this.showConfigurationForm = false;
    this.editingConfiguration = null;
  }

  async onSaveConfiguration(config: Configuration): Promise<void> {
    if (config.configuration_id) {
      // Existing configuration — update in place.
      await this.projects.updateConfiguration(config.configuration_id, config);
    } else {
      // Brand-new configuration — create a new document.
      const created = await this.projects.createConfiguration(config);
      this.editingConfiguration = created;
    }
    this.showConfigurationForm = false;
    this.editingConfiguration = null;
  }

  async onDeleteConfiguration(config: Configuration): Promise<void> {
    this.showConfigurationForm = false;
    this.editingConfiguration = null;
    this.pendingDeleteId = config.configuration_id;
    this.pendingDeleteType = 'configuration';
    this.confirmMessage = `Delete configuration <b>${config.configuration_name}</b>?<br><br><i>This cannot be undone.</i>`;
    this.showConfirm = true;
  }

  // --- Delete with confirmation ------------------------------------------

  confirmDelete(project: Project): void {
    this.pendingDeleteId = project.project_id;
    this.pendingDeleteType = 'project';
    this.confirmMessage = `Move idea <b>${project.idea_title}</b> to trash?<br><br><i>You can restore it later from the Trash view.</i>`;
    this.showConfirm = true;
  }

  async doDelete(): Promise<void> {
    if (this.pendingDeleteId) {
      if (this.pendingDeleteType === 'project') {
        await this.projects.deleteProject(this.pendingDeleteId);
      } else if (this.pendingDeleteType === 'inspiration') {
        await this.projects.deleteInspiration(this.pendingDeleteId);
      } else if (this.pendingDeleteType === 'sponsor') {
        await this.projects.deleteSponsor(this.pendingDeleteId);
      } else {
        await this.projects.deleteConfiguration(this.pendingDeleteId);
      }
    }
    this.cancelDelete();
  }

  cancelDelete(): void {
    this.pendingDeleteId = null;
    this.pendingDeleteType = 'project';
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

  // --- Stub side-screens (Sponsors) --------------------------------------

  openSponsors(): void {
    this.showConfirm = true;
    this.confirmMessage = 'Sponsors manager coming soon — wire it up next.';
  }
}