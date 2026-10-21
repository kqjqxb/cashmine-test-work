import { router } from 'expo-router';

/** Back if there is history (e.g. not a fresh page load on this URL), otherwise Home. */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
