import { createScreenRouter } from './core/screenRouter.js';
import { mountHomeScreen } from './screens/homeScreen.js';
import { openTutorialFromUrl } from './tutorial/tutorialUrl.js';

const router = createScreenRouter(document.getElementById('app'));
router.show(mountHomeScreen);
openTutorialFromUrl(router);
