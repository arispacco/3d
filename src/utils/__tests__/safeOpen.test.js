import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeOpen } from '../safeOpen.js';

const BASE = 'https://site.example/route';

describe('safeOpen', () => {
    let openSpy;
    let warnSpy;

    beforeEach(() => {
        openSpy = vi.fn(() => null);
        vi.stubGlobal('window', {
            location: { href: BASE },
            open: openSpy,
        });
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        warnSpy.mockRestore();
    });

    it('opens absolute https URLs in a new tab with noopener,noreferrer', () => {
        safeOpen('https://external.example/page');
        expect(openSpy).toHaveBeenCalledWith(
            'https://external.example/page',
            '_blank',
            'noopener,noreferrer',
        );
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('accepts plain http URLs too', () => {
        safeOpen('http://external.example/');
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('resolves site-relative URLs against the current page', () => {
        safeOpen('#contact');
        expect(openSpy).toHaveBeenCalledTimes(1);
        expect(openSpy.mock.calls[0][0]).toBe(`${BASE}#contact`);
    });

    it.each([
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'blob:https://site.example/uuid',
        'file:///etc/passwd',
        'vbscript:msgbox(1)',
        'mailto:someone@example.com',
    ])('rejects disallowed scheme %s without opening anything', (url) => {
        expect(safeOpen(url)).toBeNull();
        expect(openSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects scheme smuggling through embedded control characters', () => {
        // The URL parser strips \n and \t, turning this into javascript:...
        // — the protocol check must still catch it.
        expect(safeOpen('java\nscri\tpt:alert(1)')).toBeNull();
        expect(openSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['empty string', ''],
        ['whitespace only', '   '],
        ['undefined', undefined],
        ['null', null],
        ['number', 42],
    ])('rejects %s input without opening anything', (_label, url) => {
        expect(safeOpen(url)).toBeNull();
        expect(openSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('no-ops without a window (non-browser environment)', () => {
        vi.stubGlobal('window', undefined);
        expect(safeOpen('https://external.example/')).toBeNull();
        expect(openSpy).not.toHaveBeenCalled();
    });
});
