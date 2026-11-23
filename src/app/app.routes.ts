import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'movimientos' },
  {
    path: 'movimientos',
    title: 'Movimientos · Portal Empresas',
    loadComponent: () =>
      import('./ui/pages/movements/movements-page').then((m) => m.MovementsPage),
  },
  {
    path: 'transferencias/nueva',
    title: 'Nueva transferencia · Portal Empresas',
    loadComponent: () => import('./ui/pages/transfer/transfer-page').then((m) => m.TransferPage),
  },
  { path: '**', redirectTo: 'movimientos' },
];
