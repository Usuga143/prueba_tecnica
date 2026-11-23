import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionKeeper } from './application/session/session-keeper';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '(document:keydown)': 'onActivity()',
    '(document:pointerdown)': 'onActivity()',
    '(document:input)': 'onActivity()',
  },
})
export class App {
  protected readonly session = inject(SessionKeeper);

  constructor() {
    this.session.start();
  }

  protected onActivity(): void {
    this.session.recordActivity();
  }

  protected keepAlive(): void {
    this.session.renew().subscribe({ error: () => undefined });
  }
}
