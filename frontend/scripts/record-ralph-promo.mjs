import { chromium } from 'playwright';

const DURATION = 20000; // 20 seconds

// 4:5 aspect ratio dimensions (LinkedIn/Twitter optimized)
// Preview: 540x675, Full res: 1080x1350
const WIDTH = 540;
const HEIGHT = 675;

async function recordPromo() {
  console.log('Launching browser with video recording...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: {
      dir: './recordings',
      size: { width: WIDTH, height: HEIGHT } // 4:5 aspect ratio
    }
  });

  const page = await context.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });

  // Use record=true to hide controls, autostart=true to skip click-to-start
  console.log('Navigating to /ralph-promo with record mode...');
  await page.goto('http://localhost:4848/ralph-promo?record=true&autostart=true');

  console.log(`Recording for ${DURATION / 1000} seconds...`);
  await page.waitForTimeout(DURATION + 1000); // Extra second buffer

  console.log('Stopping recording...');
  await context.close();
  await browser.close();

  console.log('Done! Video saved to ./recordings/');
}

recordPromo().catch(console.error);
