import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCrf(18);

// Use installed Google Chrome binary if available on Windows
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
try {
  Config.setBrowserExecutable(chromePath);
} catch (e) {
  // Fall back to default Remotion Chromium
}
