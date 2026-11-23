import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from '../app/app';

describe('App', () => {
  it('renders the main navigation and the content landmark', () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('nav[aria-label="Principal"] a')?.textContent).toContain('Movimientos');
    expect(el.querySelector('main#contenido')).not.toBeNull();
  });
});
