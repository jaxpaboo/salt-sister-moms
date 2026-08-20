import { Routes } from '@angular/router';

// Each top-level section of the dashboard gets its own URL so a tab can be
// shared (or bookmarked / opened after a redirect) and the app will land on
// that section. The section is determined from the URL by AppComponent,
// which switches its view based on the active route.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'projects' },
  { path: 'projects', children: [] },
  { path: 'inspirations', children: [] },
  { path: 'sponsors', children: [] },
  { path: 'trash', children: [] },
  { path: '**', redirectTo: 'projects' },
];
