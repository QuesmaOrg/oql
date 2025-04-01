import { test, expect } from './fixtures';
import { ROUTES } from '../src/constants';

test.describe('navigating app', () => {
  test('page one should render successfully', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.One}`);
    await expect(page.getByText('This is page one.')).toBeVisible();
  });

});
