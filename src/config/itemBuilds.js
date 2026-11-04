import { BUILD_TYPE } from './buildTypes.js';

export const JUNGLE_STARTING_ITEM_ID = '1101';

export const STARTING_ITEM_ID_BY_BUILD = Object.freeze({
  [BUILD_TYPE.AD_DPS]: '1055',
  [BUILD_TYPE.AP_DPS]: '1056',
  [BUILD_TYPE.TANK]: '1054',
  [BUILD_TYPE.BRUISER]: '1055',
  [BUILD_TYPE.SUPPORT]: '3865',
});

export const BUILD_PATH_ITEM_IDS = Object.freeze({
  [BUILD_TYPE.AD_DPS]: ['6672', '3006', '3031', '3094', '3036', '3072'],
  [BUILD_TYPE.AP_DPS]: ['6655', '3020', '4645', '3089', '3157', '3135'],
  [BUILD_TYPE.TANK]: ['3068', '3047', '6665', '3075', '3065', '3143'],
  [BUILD_TYPE.BRUISER]: ['3078', '3111', '6610', '6333', '3161', '3065'],
  [BUILD_TYPE.SUPPORT]: ['3158', '3190', '3107', '3222', '3050', '3109'],
});
