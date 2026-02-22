/**
 * Returns true when `pathname` matches `href`.
 * If `exact` is false (default), a path prefix match is also accepted.
 */
export function isActive(pathname: string, href: string, exact = false): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
}
