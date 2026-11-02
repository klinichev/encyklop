import politicalData from './data/political.json';
import religionData from './data/religion.json';
import languageData from './data/language.json';
import suzeraintyData from './data/suzerainty.json';
import { compileLayer, holdingIn, realmIn, suzerainIn } from './timeline-core';
import type { Holding, LayerData, LayerId } from './timeline-core';

const compiled: Record<LayerId, ReturnType<typeof compileLayer>> = {
  political: compileLayer(politicalData as unknown as LayerData),
  religion: compileLayer(religionData as unknown as LayerData),
  language: compileLayer(languageData as unknown as LayerData),
};

export const getEntity = (layer: LayerId, id: string) => compiled[layer].entityById.get(id)!;

export const holdingAt = (layer: LayerId, province: string, year: number): Holding =>
  holdingIn(compiled[layer], province, year)!;

export const suzerainAt = (entity: string, year: number) => suzerainIn(suzeraintyData, entity, year);

// Граница тоньше внутри одной общности: у державы это верхний сюзерен, у религии и языка — группа
export const familyAt = (layer: LayerId, entity: string, year: number) =>
  layer === 'political' ? realmIn(suzeraintyData, entity, year) : getEntity(layer, entity).group ?? entity;
