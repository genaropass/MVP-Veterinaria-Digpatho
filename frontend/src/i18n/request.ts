import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

/**
 * @remarks
 * Request configuration for `next-intl`.
 * Uses cookies to determine the user's preferred locale. If none is found, defaults to `es`.
 * @returns {Promise<Object>} Request config including locale and messages.
 */
export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = (await cookieStore).get('locale')?.value || 'es';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
