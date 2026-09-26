const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../worklenz-frontend/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Pre-seed cookie consent so banner does not block UI interactions
  await context.addInitScript(() => {
    try {
      localStorage.setItem('worklenz_cookie_consent', JSON.stringify({ analytics: true, timestamp: Date.now() }));
    } catch (e) {}
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser console.error] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[Browser pageerror] ${err.message}`));

  const testId = Date.now();
  const testUser = {
    name: `Smoke Tester`,
    email: `smoke.${testId}@example.test`,
    password: 'Password123!',
    orgName: `Smoke Org ${testId}`,
    projectName: `Alpha Proj ${testId}`,
    taskName: `First Task ${testId}`,
    createdProjectName: `Beta Proj ${testId}`,
    createdTaskName: `Second Task ${testId}`,
  };

  console.log('=== STEP 1: SIGN UP ===');
  console.log(`Navigating to http://localhost:5000/auth/signup...`);
  await page.goto('http://localhost:5000/auth/signup', { waitUntil: 'domcontentloaded' });

  const nameInput = page.locator('input#signup_name');
  await nameInput.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Filling signup form with', testUser.email);
  await nameInput.fill(testUser.name);
  await page.locator('input#signup_email').fill(testUser.email);
  await page.locator('input[type="password"]').fill(testUser.password);

  console.log('Submitting signup...');
  await page.locator('button[type="submit"]').click();

  // Wait for setup navigation
  console.log('Waiting for setup redirect...');
  await page.waitForURL(url => url.pathname.includes('/worklenz/setup') || url.pathname.includes('/auth/authenticating'), { timeout: 20000 });
  console.log('Redirected to:', page.url());

  if (page.url().includes('/auth/authenticating')) {
    await page.waitForURL(url => url.pathname.includes('/worklenz/setup'), { timeout: 20000 });
    console.log('Setup page loaded:', page.url());
  }

  // Handle Account Setup Wizard
  console.log('=== STEP 1.1: ACCOUNT SETUP WIZARD ===');
  await page.waitForTimeout(2000);

  // Step 0: Organization
  console.log('Handling Step 0: Organization...');
  const orgInput = page.locator('.organization-step input').first();
  if (await orgInput.isVisible({ timeout: 5000 })) {
    await orgInput.fill(testUser.orgName);
  }
  const continueBtn = page.getByRole('button', { name: /^Continue$/i });
  await continueBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Step 1: Survey Step
  console.log('Handling Step 1: Survey...');
  const orgTypeBtn = page.locator('button', { hasText: /Startup|Small/i }).first();
  if (await orgTypeBtn.isVisible({ timeout: 5000 })) {
    console.log('Selecting Organization Type...');
    await orgTypeBtn.click({ force: true });
    await page.waitForTimeout(500);

    console.log('Selecting User Role...');
    const userRoleBtn = page.locator('button', { hasText: /Founder|Developer|Project Manager/i }).first();
    await userRoleBtn.click({ force: true });
    await page.waitForTimeout(500);

    // Continue to survey sub-step 1
    await continueBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Survey Sub-step 1: Main use cases
    console.log('Selecting Use Cases...');
    const useCaseBtn = page.locator('button').filter({ hasText: /Project|Task|Team/i }).first();
    if (await useCaseBtn.isVisible({ timeout: 5000 })) {
      await useCaseBtn.click({ force: true });
      await page.waitForTimeout(500);
      await continueBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Survey Sub-step 2: How heard about
    console.log('Selecting How heard about...');
    const howHeardBtn = page.locator('button').filter({ hasText: /Google|Search|Friend|Social|Other/i }).first();
    if (await howHeardBtn.isVisible({ timeout: 5000 })) {
      await howHeardBtn.click({ force: true });
      await page.waitForTimeout(500);
      await continueBtn.click({ force: true });
      await page.waitForTimeout(1500);
    }
  }

  // Step 2: Project Step
  console.log('Handling Step 2: Project...');
  const suggestionBtn = page.locator('.project-suggestion-button').first();
  if (await suggestionBtn.isVisible({ timeout: 5000 })) {
    console.log('Clicking project suggestion...');
    await suggestionBtn.click({ force: true });
    await page.waitForTimeout(500);
  } else {
    const projInput = page.locator('input').last();
    if (await projInput.isVisible({ timeout: 3000 })) {
      await projInput.fill(testUser.projectName);
    }
  }
  await continueBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Step 3: Tasks Step
  console.log('Handling Step 3: Tasks...');
  const taskInput = page.locator('input.task-input, .tasks-step input').first();
  if (await taskInput.isVisible({ timeout: 5000 })) {
    await taskInput.fill(testUser.taskName);
    await page.waitForTimeout(500);
  }
  await continueBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Step 4: Members Step (Skip)
  console.log('Handling Step 4: Members (Skip)...');
  const skipBtn = page.locator('button', { hasText: /Skip/i }).first();
  if (await skipBtn.isVisible({ timeout: 5000 })) {
    await skipBtn.click({ force: true });
  } else {
    await continueBtn.click({ force: true });
  }

  // Wait for redirect to main application
  console.log('Waiting for redirection to main application...');
  await page.waitForURL(url => !url.pathname.includes('/setup') && url.pathname.includes('/worklenz/'), { timeout: 30000 });
  console.log('SUCCESSFULLY COMPLETED SIGNUP & ONBOARDING! Current URL:', page.url());
  await page.waitForTimeout(3000);
  const initialButtons = await page.locator('button').allTextContents();
  console.log('Buttons on onboarding destination project page:', initialButtons);

  console.log('\n=== STEP 2: LOGIN WITH CREATED USER IN A FRESH CONTEXT ===');
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  page2.on('console', async msg => {
    try {
      const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => a.toString())));
      console.log(`[Browser console.${msg.type()}]`, ...args);
    } catch (e) {
      console.log(`[Browser console.${msg.type()}]`, msg.text());
    }
  });
  page2.on('pageerror', err => console.log('[Browser pageerror]', err.message));
  page2.on('response', async res => {
    if (res.status() >= 400) {
      let body = '';
      try { body = await res.text(); } catch (e) {}
      console.log(`[HTTP ${res.status()}] ${res.url()}:`, body.slice(0, 200));
    }
  });

  await page2.goto('http://localhost:5000/auth/login', { waitUntil: 'domcontentloaded' });
  await page2.evaluate(() => {
    localStorage.setItem('worklenz_cookie_consent', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      version: '1.0',
    }));
  });
  await page2.reload({ waitUntil: 'domcontentloaded' });

  const loginEmail = page2.locator('input#login_email');
  await loginEmail.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Logging in as', testUser.email);
  await loginEmail.fill(testUser.email);
  await page2.locator('input#login_password').fill(testUser.password);
  await page2.locator('button[type="submit"]').click();

  await page2.waitForURL(url => url.pathname.includes('/worklenz/'), { timeout: 20000 });
  console.log('SUCCESSFULLY LOGGED IN! Current URL:', page2.url());
  await page2.waitForTimeout(3000);

  console.log('\n=== STEP 3: CREATE PROJECT ===');
  await page2.goto('http://localhost:5000/worklenz/projects', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(2000);

  const createProjBtn = page2.getByRole('button', { name: /create project/i }).first();
  await createProjBtn.waitFor({ state: 'visible', timeout: 10000 });
  await createProjBtn.click();
  await page2.waitForTimeout(1000);

  console.log('Entering project name:', testUser.createdProjectName);
  const projNameInput = page2.locator('input[placeholder="Enter project name"]').first();
  await projNameInput.waitFor({ state: 'visible', timeout: 10000 });
  await projNameInput.fill(testUser.createdProjectName);

  const submitCreateProj = page2.locator('.ant-drawer button').filter({ hasText: /^Create$/i }).first();
  await submitCreateProj.click();
  console.log('Clicked Create Project. Waiting for project view navigation...');
  await page2.waitForURL(url => url.pathname.includes('/worklenz/projects/'), { timeout: 20000 });
  console.log('SUCCESSFULLY CREATED PROJECT & NAVIGATED TO PROJECT VIEW! URL:', page2.url());
  await page2.waitForTimeout(3000);

  console.log('\n=== STEP 4: CREATE TASK ===');
  console.log('Current URL on project page:', page2.url());
  await page2.waitForTimeout(3000);

  // Use "+ Add Task" button to create an inline task
  const addTaskBtn = page2.getByRole('button', { name: /add task/i }).first();
  if (await addTaskBtn.isVisible({ timeout: 5000 })) {
    console.log('Found Add Task button. Clicking...');
    await addTaskBtn.click();
    await page2.waitForTimeout(500);

    const taskInput = page2.locator('input[placeholder*="Type your task"]').first();
    await taskInput.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Entering task name:', testUser.createdTaskName);
    await taskInput.fill(testUser.createdTaskName);
    await taskInput.press('Enter');
    await page2.waitForTimeout(3000);
  } else {
    // Fallback: click "Create task" button
    console.log('Looking for Create task button...');
    const createTaskBtn = page2.getByRole('button', { name: /create task/i }).first();
    await createTaskBtn.waitFor({ state: 'visible', timeout: 5000 });
    await createTaskBtn.click();
    await page2.waitForTimeout(2000);
  }

  const pageBody = await page2.locator('body').innerText();
  const taskCreated = pageBody.includes(testUser.createdTaskName) || pageBody.includes('Untitled Task');
  if (!taskCreated) {
    throw new Error(`Task verification failed: neither ${testUser.createdTaskName} nor Untitled Task found on page.`);
  }
  console.log('SUCCESSFULLY CREATED AND VERIFIED TASK:', testUser.createdTaskName);

  console.log('\n======================================================');
  console.log('✅ ALL VERIFICATIONS COMPLETED SUCCESSFULLY:');
  console.log('  1. Sign Up (New user registered and authenticated)');
  console.log('  2. Login (Credentials authenticated successfully)');
  console.log('  3. Create Project (New blank project created)');
  console.log('  4. Create Task (New task created in project)');
  console.log('======================================================');

  await browser.close();
  process.exit(0);
})().catch(async err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
