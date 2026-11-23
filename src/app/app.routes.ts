import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'movimientos' },
  {
    path: 'movimientos',
    title: 'Movimientos · Portal Empresas',
    loadComponent: () =>
      import('./ui/pages/movements/movements-page').then((m) => m.MovementsPage),
  },
  { path: '**', redirectTo: 'movimientos' },
];
