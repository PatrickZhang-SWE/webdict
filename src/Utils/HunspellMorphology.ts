import { HunspellReader } from 'hunspell-reader';
import { type HunSpellWordInfo } from '../common/HunSpellWordInfo.js';
import { addMorphologies } from './sqlite.js';

export async function setUpMorphology(affPath: string, dicPath: string) {
    const reader = await HunspellReader.createFromFiles(affPath, dicPath);
    const morphologies: HunSpellWordInfo[] = [];
    for (const affArr of reader.seqTransformDictionaryEntries()) {
        for (const aff of affArr) {
            morphologies.push({
                word: aff.dic.includes('/') ? aff.dic.split('/')[0] : aff.dic,
                morph: aff.word,
            });
        }
    }
    await addMorphologies(morphologies);
}