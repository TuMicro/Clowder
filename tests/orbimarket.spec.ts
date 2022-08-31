import { test, expect } from '@playwright/test';

test('evBirds', async ({ page }) => {
  await page.goto('https://www.orbitmarket.io/collection/0xf2e8a8509ab69af07c7b3636a1db8d2b600e0572');  

  // create a locator
  const getStarted = page.locator('text=evBirds');

  console.log(getStarted);
});
