import { ROLE } from './roles.js';

export const BUILD_TYPE = Object.freeze({
  AD_DPS: 'adDps',
  AP_DPS: 'apDps',
  TANK: 'tank',
  BRUISER: 'bruiser',
  SUPPORT: 'support',
});

export const BUILD_TYPES = Object.freeze({
  adDps: { label: 'AD DPS', runePreset: 'Precision · Lethal Tempo' },
  apDps: { label: 'AP DPS', runePreset: 'Domination · Electrocute' },
  tank: { label: 'Tank', runePreset: 'Resolve · Grasp of the Undying' },
  bruiser: { label: 'Bruiser', runePreset: 'Precision · Conqueror' },
  support: { label: 'Support', runePreset: 'Resolve · Guardian' },
});

const DAMAGE_AND_FRONTLINE_BUILDS = [BUILD_TYPE.AD_DPS, BUILD_TYPE.AP_DPS, BUILD_TYPE.TANK, BUILD_TYPE.BRUISER];

const BUILD_TYPE_BY_PRIMARY_TAG = Object.freeze({
  Marksman: BUILD_TYPE.AD_DPS,
  Mage: BUILD_TYPE.AP_DPS,
  Tank: BUILD_TYPE.TANK,
  Fighter: BUILD_TYPE.BRUISER,
  Support: BUILD_TYPE.SUPPORT,
});

export function buildTypesAvailableForRole(role) {
  return role === ROLE.SUPPORT ? [BUILD_TYPE.SUPPORT, ...DAMAGE_AND_FRONTLINE_BUILDS] : DAMAGE_AND_FRONTLINE_BUILDS;
}

export function defaultBuildTypeFor(champion, role) {
  if (role === ROLE.SUPPORT) {
    return BUILD_TYPE.SUPPORT;
  }
  const [primaryTag] = champion.tags;
  if (primaryTag === 'Assassin') {
    return isMagicDamageChampion(champion) ? BUILD_TYPE.AP_DPS : BUILD_TYPE.AD_DPS;
  }
  const buildType = BUILD_TYPE_BY_PRIMARY_TAG[primaryTag] ?? BUILD_TYPE.BRUISER;
  return buildType === BUILD_TYPE.SUPPORT ? BUILD_TYPE.AP_DPS : buildType;
}

function isMagicDamageChampion(champion) {
  return champion.info.magic > champion.info.attack;
}
