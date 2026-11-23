import * as axe from 'axe-core';

/** Reglas WCAG 2.0, 2.1 y 2.2 niveles A y AA. */
const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Revisión automática de accesibilidad con axe-core. Falla con la lista de violaciones encontradas. */
export async function expectNoAccessibilityViolations(element: HTMLElement): Promise<void> {
  const results = await axe.run(element, { runOnly: { type: 'tag', values: WCAG_AA_TAGS } });
  const violations = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(violations).withContext('Violaciones de accesibilidad').toEqual([]);
}
