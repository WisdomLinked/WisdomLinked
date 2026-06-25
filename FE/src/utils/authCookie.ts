/** Clear any non-httpOnly accessToken set via document.cookie (OAuth bootstrap legacy). */
export function clearClientAccessTokenCookie(): void {
    document.cookie = 'accessToken=; path=/; max-age=0';
}
