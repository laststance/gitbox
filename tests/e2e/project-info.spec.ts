/**
 * E2E Test: Project Info Modal
 *
 * Constitution要件:
 * - Principle II: クリティカルフローのE2Eテストカバレッジ
 * - Principle IV: WCAG AA準拠
 * - Principle VI: TDD - テストファースト
 *
 * User Story 4受け入れシナリオ:
 * 1. Overflow menuから"Edit Project Info"選択 → モーダル表示
 * 2. Quick noteにメモ入力 → 保存
 * 3. Production URL追加 → リスト表示
 * 4. Tracking services URL追加 → 新しいタブで開く
 * 5. Supabase Dashboard URL追加 → 保存
 * 6. Saveボタンクリック → モーダル閉じる
 */

import { test, expect } from '@playwright/test';

test.describe('Project Info Modal (US4)', () => {
  test.beforeEach(async ({ page }) => {
    // 認証済み状態でボード画面にアクセス
    // Board ID: 00000000-0000-0000-0000-000000000100 (see supabase/seed.sql)
    await page.goto('/board/00000000-0000-0000-0000-000000000100');
    await page.waitForLoadState('networkidle');

    // テスト分離のため、既存のProject Info URLをクリア
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await modal.waitFor({ state: 'visible' });

    // 既存のURLをすべて削除
    const deleteButtons = modal.locator('button[data-testid^="remove-url"]');
    const deleteCount = await deleteButtons.count();
    for (let i = 0; i < deleteCount; i++) {
      // 常に最初のボタンを削除（削除すると次の要素が最初になる）
      await deleteButtons.first().click();
    }

    // Quick noteもクリア
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]'
    );
    await quickNoteTextarea.fill('');

    // 保存して閉じる
    await modal.locator('[data-testid="save-button"]').click();
    await modal.waitFor({ state: 'hidden' });
  });

  test('Scenario 1: Open Project Info modal from overflow menu', async ({
    page,
  }) => {
    // Given: Repository カードが存在する
    const card = page.locator('[data-testid="repo-card"]').first();
    await expect(card).toBeVisible();

    // When: カード右上の ⋯ メニューから "Edit Project Info" を選択
    await card.hover();
    const menuTrigger = card.locator(
      '[data-testid^="overflow-menu-trigger"]'
    );
    await menuTrigger.click();

    const editButton = page.locator('[data-testid^="edit-project"]');
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Then: Project Info モーダルが表示される
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible({ timeout: 2000 });

    // モーダルタイトルが正しい
    await expect(modal.locator('h2')).toContainText('Project Info');

    // Screenshot: モーダル初期表示（空の状態）
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-modal-empty.png',
      fullPage: true,
    });
  });

  test('Scenario 2: Add and save Quick note', async ({ page }) => {
    // Given: Project Info モーダルが表示されている
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Quick note セクションに1〜3行のメモを入力する
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]'
    );
    await expect(quickNoteTextarea).toBeVisible();

    const noteText =
      'This is a test project\nMain production app\nDeployed on Vercel';
    await quickNoteTextarea.fill(noteText);

    // 文字数制限（300文字）を確認
    const charCount = modal.locator('[data-testid="char-count"]');
    await expect(charCount).toContainText('61 / 300');

    // Screenshot: Quick note入力後
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-quick-note.png',
      fullPage: true,
    });

    // When: Saveボタンをクリック
    await modal.locator('[data-testid="save-button"]').click();

    // Then: メモが保存され、モーダルが閉じる
    await expect(modal).not.toBeVisible({ timeout: 2000 });

    // 再度モーダルを開いて保存されたことを確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();
    await expect(quickNoteTextarea).toHaveValue(noteText);
  });

  test('Scenario 3: Add multiple Production URLs', async ({ page }) => {
    // Given: Links セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Production URL を複数追加する
    const addUrlButton = modal.locator('[data-testid="add-url-button"]');
    await expect(addUrlButton).toBeVisible();

    // 1つ目のURL追加
    await addUrlButton.click();
    const urlInput = modal
      .locator('[data-testid^="url-input"]')
      .first();
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://example.com');

    // 2つ目のURL追加
    await addUrlButton.click();
    const urlInput2 = modal
      .locator('[data-testid^="url-input"]')
      .nth(1);
    await expect(urlInput2).toBeVisible();
    await urlInput2.fill('https://staging.example.com');

    // Then: 全ての URL が保存され、リスト表示される
    const urlList = modal.locator('[data-testid="url-list"]');
    await expect(urlList.locator('li')).toHaveCount(2);

    // URLリンクが正しく表示される
    await expect(urlList).toContainText('example.com');
    await expect(urlList).toContainText('staging.example.com');

    // Screenshot: 複数URL登録後
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-multiple-urls.png',
      fullPage: true,
    });
  });

  test('Scenario 4: Add Tracking services URL and open in new tab', async ({
    page,
    context,
  }) => {
    // Given: Links セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Tracking services URL を追加
    await modal.locator('[data-testid="add-url-button"]').click();

    // カスタムコンボボックスを操作: 最後に追加されたURL行を対象にする
    const urlTypeSelect = modal.locator('[data-testid="url-type-select"]').last();
    await expect(urlTypeSelect).toBeVisible();
    await urlTypeSelect.click();
    // Tracking オプションを選択
    await page.getByRole('option', { name: 'Tracking' }).click();

    const urlInput = modal.locator('[data-testid^="url-input"]').last();
    await urlInput.fill('https://analytics.google.com/dashboard');

    // Saveして閉じる
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();

    // 再度開く
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();

    // Then: クリックで新しいタブで開ける
    const urlLink = modal
      .locator('[data-testid="url-list"]')
      .locator('a')
      .first();

    // target="_blank"属性を確認
    await expect(urlLink).toHaveAttribute('target', '_blank');
    await expect(urlLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('Scenario 5: Add Supabase Dashboard links', async ({ page }) => {
    // Given: Links セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Supabase Dashboard のリンクを追加する
    await modal.locator('[data-testid="add-url-button"]').click();

    // カスタムコンボボックスを操作: 最後に追加されたURL行を対象にする
    const urlTypeSelect = modal.locator('[data-testid="url-type-select"]').last();
    await expect(urlTypeSelect).toBeVisible();
    await urlTypeSelect.click();
    // Supabase オプションを選択
    await page.getByRole('option', { name: 'Supabase' }).click();

    const urlInput = modal.locator('[data-testid^="url-input"]').last();
    await urlInput.fill(
      'https://app.supabase.com/project/abc123/editor'
    );

    // Then: プロジェクト参照リンクが保存される
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();

    // 保存確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();

    const urlList = modal.locator('[data-testid="url-list"]');
    await expect(urlList).toContainText('supabase.com');
  });

  test('Scenario 6: Save changes and close modal', async ({ page }) => {
    // Given: Project Info を編集した
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // Quick noteを編集
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]'
    );
    await quickNoteTextarea.fill('Updated project info');

    // When: "Save" ボタンをクリックする
    const saveButton = modal.locator('[data-testid="save-button"]');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Then: 変更が保存され、モーダルが閉じる
    await expect(modal).not.toBeVisible({ timeout: 2000 });

    // ボードビューに戻っている
    const board = page.locator('[data-testid="repo-card"]');
    await expect(board.first()).toBeVisible();
  });

  test('Cancel button closes modal without saving', async ({ page }) => {
    // Given: モーダルで編集中
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // 編集
    const quickNoteTextarea = modal.locator(
      '[data-testid="quick-note-textarea"]'
    );
    await quickNoteTextarea.fill('This should not be saved');

    // When: Cancelボタンをクリック
    const cancelButton = modal.locator('[data-testid="cancel-button"]');
    await cancelButton.click();

    // Then: モーダルが閉じる（保存されない）
    await expect(modal).not.toBeVisible();

    // 再度開いて保存されていないことを確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();
    await expect(quickNoteTextarea).not.toHaveValue(
      'This should not be saved'
    );
  });

  test('WCAG AA Accessibility compliance', async ({ page }) => {
    // モーダルを開く
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // フォーカス管理
    const firstFocusable = modal.locator('[data-testid="quick-note-textarea"]');
    await expect(firstFocusable).toBeFocused();

    // キーボードナビゲーション（Tabキー）
    await page.keyboard.press('Tab');
    const addUrlButton = modal.locator('[data-testid="add-url-button"]');
    await expect(addUrlButton).toBeFocused();

    // ESCキーでモーダルを閉じる
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('URL validation', async ({ page }) => {
    // モーダルを開く
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // 無効なURL入力
    await modal.locator('[data-testid="add-url-button"]').click();
    const urlInput = modal.locator('[data-testid^="url-input"]').first();
    await urlInput.fill('not-a-valid-url');

    // バリデーションエラー表示
    const errorMessage = modal.locator('[data-testid="url-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Please enter a valid URL');

    // Saveボタンが無効化
    const saveButton = modal.locator('[data-testid="save-button"]');
    await expect(saveButton).toBeDisabled();

    // Screenshot: URLバリデーションエラー表示
    await page.screenshot({
      path: 'tests/e2e/screenshots/us4-project-info-url-validation-error.png',
      fullPage: true,
    });

    // 有効なURLに修正
    await urlInput.fill('https://example.com');
    await expect(errorMessage).not.toBeVisible();
    await expect(saveButton).toBeEnabled();
  });
});

test.describe('Project Info Modal - Credentials (US5)', () => {
  test.beforeEach(async ({ page }) => {
    // 認証済み状態でボード画面にアクセス
    await page.goto('/board/00000000-0000-0000-0000-000000000100');
    await page.waitForLoadState('networkidle');

    // Project Info モーダルを開く
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await modal.waitFor({ state: 'visible' });

    // 既存のCredentialsをクリア
    const deleteButtons = modal.locator('button[data-testid^="remove-credential"]');
    const deleteCount = await deleteButtons.count();
    for (let i = 0; i < deleteCount; i++) {
      await deleteButtons.first().click();
    }

    // 保存して閉じる
    await modal.locator('[data-testid="save-button"]').click();
    await modal.waitFor({ state: 'hidden' });
  });

  test('Scenario 1: Add Pattern A (Reference) credential', async ({ page }) => {
    // Given: Credentials セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Pattern A (Reference) credentialを追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');
    await addCredentialButton.click();

    // Credential typeを選択
    const credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').first();
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'Reference' }).click();

    // Credential nameを入力
    const nameInput = modal.locator('[data-testid^="credential-name"]').first();
    await nameInput.fill('Stripe Dashboard');

    // Reference URLを入力
    const referenceInput = modal.locator('[data-testid^="credential-reference"]').first();
    await referenceInput.fill('https://dashboard.stripe.com');

    // Noteを入力
    const noteInput = modal.locator('[data-testid^="credential-note"]').first();
    await noteInput.fill('Production API keys');

    // Screenshot: Pattern A credential入力後
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-a.png',
      fullPage: true,
    });

    // Then: 保存してモーダルを閉じる
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();

    // 再度開いて保存されたことを確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();

    await expect(nameInput).toHaveValue('Stripe Dashboard');
    await expect(referenceInput).toHaveValue('https://dashboard.stripe.com');
    await expect(noteInput).toHaveValue('Production API keys');
  });

  test('Scenario 2: Add Pattern B (Encrypted) credential with masked display', async ({ page }) => {
    // Given: Credentials セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Pattern B (Encrypted) credentialを追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');
    await addCredentialButton.click();

    // Credential typeを選択
    const credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').first();
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'Encrypted' }).click();

    // Credential nameを入力
    const nameInput = modal.locator('[data-testid^="credential-name"]').first();
    await nameInput.fill('Stripe API Key');

    // Encrypted valueを入力
    const encryptedInput = modal.locator('[data-testid^="credential-encrypted"]').first();
    await encryptedInput.fill('sk_live_51H4RdE2BqJhGwM5N8XyZ123');

    // Then: マスク表示が自動生成される（input type="password"なので値は見えない）
    await expect(encryptedInput).toHaveAttribute('type', 'password');

    // Screenshot: Pattern B credential入力後（マスク表示）
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-b-masked.png',
      fullPage: true,
    });

    // 保存
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('Scenario 3: Reveal encrypted credential value with 30-second auto-hide', async ({ page }) => {
    // Given: Pattern B credentialが保存されている
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // Encrypted credential追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');
    await addCredentialButton.click();

    const credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').first();
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'Encrypted' }).click();

    const nameInput = modal.locator('[data-testid^="credential-name"]').first();
    await nameInput.fill('Test API Key');

    const encryptedInput = modal.locator('[data-testid^="credential-encrypted"]').first();
    const testValue = 'sk_test_1234567890abcdef';
    await encryptedInput.fill(testValue);

    // When: Revealボタンをクリック
    const revealButton = modal.locator('[data-testid^="toggle-reveal"]').first();
    await expect(revealButton).toBeVisible();
    await revealButton.click();

    // Then: 値が表示される（type="text"に変わる）
    await expect(encryptedInput).toHaveAttribute('type', 'text');
    await expect(encryptedInput).toHaveValue(testValue);

    // アイコンがEyeOffに変わる
    await expect(revealButton.locator('svg')).toBeVisible();

    // Screenshot: Revealed state
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-revealed.png',
      fullPage: true,
    });

    // 再度クリックして隠す
    await revealButton.click();
    await expect(encryptedInput).toHaveAttribute('type', 'password');

    // Note: 30秒のauto-hide timerはE2Eテストでは実行時間が長すぎるため、
    // ユニットテストでカバー済み
  });

  test('Scenario 4: Add Pattern C (External) credential', async ({ page }) => {
    // Given: Credentials セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // When: Pattern C (External) credentialを追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');
    await addCredentialButton.click();

    // Credential typeを選択
    const credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').first();
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'External' }).click();

    // Credential nameを入力
    const nameInput = modal.locator('[data-testid^="credential-name"]').first();
    await nameInput.fill('Production Database');

    // External locationを入力
    const locationInput = modal.locator('[data-testid^="credential-location"]').first();
    await locationInput.fill('1Password > Team Vault > Production Credentials');

    // Noteを入力
    const noteInput = modal.locator('[data-testid^="credential-note"]').first();
    await noteInput.fill('PostgreSQL admin password');

    // Screenshot: Pattern C credential入力後
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-pattern-c.png',
      fullPage: true,
    });

    // Then: 保存
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();

    // 再度開いて確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();

    await expect(nameInput).toHaveValue('Production Database');
    await expect(locationInput).toHaveValue('1Password > Team Vault > Production Credentials');
    await expect(noteInput).toHaveValue('PostgreSQL admin password');
  });

  test('Scenario 5: Add multiple credentials of different patterns', async ({ page }) => {
    // Given: Credentials セクションにいる
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');

    // Pattern A
    await addCredentialButton.click();
    let credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').nth(0);
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'Reference' }).click();
    await modal.locator('[data-testid^="credential-name"]').nth(0).fill('AWS Console');
    await modal.locator('[data-testid^="credential-reference"]').nth(0).fill('https://console.aws.amazon.com');

    // Pattern B
    await addCredentialButton.click();
    credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').nth(1);
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'Encrypted' }).click();
    await modal.locator('[data-testid^="credential-name"]').nth(1).fill('GitHub Token');
    await modal.locator('[data-testid^="credential-encrypted"]').nth(1).fill('ghp_1234567890abcdefABCDEF');

    // Pattern C
    await addCredentialButton.click();
    credentialTypeSelect = modal.locator('[data-testid^="credential-type-select"]').nth(2);
    await credentialTypeSelect.click();
    await page.getByRole('option', { name: 'External' }).click();
    await modal.locator('[data-testid^="credential-name"]').nth(2).fill('SSH Key');
    await modal.locator('[data-testid^="credential-location"]').nth(2).fill('Bitwarden > Server Keys');

    // Screenshot: Multiple credentials
    await page.screenshot({
      path: 'tests/e2e/screenshots/us5-credentials-multiple.png',
      fullPage: true,
    });

    // Then: 全て保存される
    await modal.locator('[data-testid="save-button"]').click();
    await expect(modal).not.toBeVisible();

    // 再度開いて全て保存されていることを確認
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    await expect(modal).toBeVisible();

    const credentialNames = modal.locator('[data-testid^="credential-name"]');
    await expect(credentialNames).toHaveCount(3);
    await expect(credentialNames.nth(0)).toHaveValue('AWS Console');
    await expect(credentialNames.nth(1)).toHaveValue('GitHub Token');
    await expect(credentialNames.nth(2)).toHaveValue('SSH Key');
  });

  test('Scenario 6: Delete credential', async ({ page }) => {
    // Given: Credentialが追加されている
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // Credential追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');
    await addCredentialButton.click();
    await addCredentialButton.click();

    let credentialNames = modal.locator('[data-testid^="credential-name"]');
    await expect(credentialNames).toHaveCount(2);

    // When: 削除ボタンをクリック
    const deleteButton = modal.locator('[data-testid^="remove-credential"]').first();
    await deleteButton.click();

    // Then: Credentialが削除される
    credentialNames = modal.locator('[data-testid^="credential-name"]');
    await expect(credentialNames).toHaveCount(1);
  });

  test('WCAG AA: Credentials section keyboard navigation', async ({ page }) => {
    // モーダルを開く
    await page.locator('[data-testid="repo-card"]').first().hover();
    await page
      .locator('[data-testid^="overflow-menu-trigger"]')
      .first()
      .click();
    await page.locator('[data-testid^="edit-project"]').click();
    const modal = page.locator('[data-testid="project-info-modal"]');
    await expect(modal).toBeVisible();

    // Credential追加
    const addCredentialButton = modal.locator('[data-testid="add-credential-button"]');

    // Tabキーでadd credentialボタンまで移動（Quick note → Add URL → Add Credential）
    await page.keyboard.press('Tab'); // Quick noteから離れる
    await page.keyboard.press('Tab'); // Add URL
    await page.keyboard.press('Tab'); // Add Credential
    await expect(addCredentialButton).toBeFocused();

    // Enterキーで追加
    await page.keyboard.press('Enter');

    // Credential nameにフォーカスが移る
    const nameInput = modal.locator('[data-testid^="credential-name"]').first();
    await expect(nameInput).toBeVisible();
  });
});
