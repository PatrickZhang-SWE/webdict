import { HunspellReader } from 'hunspell-reader';
import { type HunSpellWordInfo } from '../common/HunSpellWordInfo.js';
import { addMorphology } from './sqlite.js';

export async function setUpMorphology(affPath: string, dicPath: string) {
    const reader = await HunspellReader.createFromFiles(affPath, dicPath);
    const rootWords = reader.seqRootWords().toArray();
    const rootWordNumber = reader.size;
    let index = 1;
    let currentRoot = rootWords[0];
    let nextRoot = rootWords[index];
    let hunSpellWordInfo: HunSpellWordInfo = { word: currentRoot, morph: [currentRoot] };
    for (const word of reader) {
        if (index >= rootWordNumber) {
            addMorphology(hunSpellWordInfo);
            break;
        }
        if (word === nextRoot) {
            addMorphology(hunSpellWordInfo);
            currentRoot = nextRoot;
            nextRoot = rootWords[++index];
            hunSpellWordInfo = { word: currentRoot, morph: [currentRoot] };
        }
        hunSpellWordInfo.morph.push(word);
    }
}