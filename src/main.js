import { createScreenRouter } from './core/screenRouter.js';
import { mountHomeScreen } from './screens/homeScreen.js';

const router = createScreenRouter(document.getElementById('app'));
router.show(mountHomeScreen);
