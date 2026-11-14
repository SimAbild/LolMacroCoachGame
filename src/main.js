import { createScreenRouter } from './core/screenRouter.js';
import { mountHomeScreen } from './screens/homeScreen.js';
import { openTutorialFromUrl } from './tutorial/tutorialUrl.js';
import { mountFullscreenToggle } from './ui/fullscreenToggle.js';

const router = createScreenRouter(document.getElementById('app'));
router.show(mountHomeScreen);
// Lives as long as the page, so its clean-up is never needed here.
mountFullscreenToggle(document.body);
openTutorialFromUrl(router);
