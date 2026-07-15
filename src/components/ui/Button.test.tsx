// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(el: ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  act(() => {
    createRoot(host).render(el);
  });
  const b = host.querySelector('button');
  if (!b) throw new Error('botao nao renderizou');
  return b;
}

describe('Button', () => {
  it('sem a prop busy, nao interfere no clique', () => {
    const spy = vi.fn();
    const b = render(<Button onClick={spy}>Ok</Button>);
    act(() => {
      b.click();
      b.click();
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(b.getAttribute('aria-busy')).toBeNull();
  });

  it('busy marca aria-busy, bloqueia o clique e mantem o botao focavel', () => {
    const spy = vi.fn();
    const b = render(
      <Button busy onClick={spy}>
        Salvando
      </Button>,
    );
    act(() => {
      b.click();
    });
    expect(spy).not.toHaveBeenCalled();
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.disabled).toBe(false);
    b.focus();
    expect(document.activeElement).toBe(b);
  });

  it('trava o 2o clique do mesmo tick, antes de busy propagar', () => {
    const spy = vi.fn();
    const b = render(
      <Button busy={false} onClick={spy}>
        Salvar
      </Button>,
    );
    act(() => {
      b.click();
      b.click();
      b.click();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('libera a trava no tick seguinte quando o handler nao entra em busy', async () => {
    const spy = vi.fn();
    const b = render(
      <Button busy={false} onClick={spy}>
        Salvar
      </Button>,
    );
    act(() => {
      b.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    act(() => {
      b.click();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
