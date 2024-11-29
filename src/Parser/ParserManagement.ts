import { type ParserResultText, type ParserResultBinary } from '../common/ParserResult.js'
import { type DictInfo } from '../common/DictInfo.js'
import { parse as parseMDXFile } from './MDXParser.js'
import { getDictInfo as MDXGetDictInfo } from './MDXParser.js'

const parserMap = new Map<string, (buff: ArrayBuffer) => Promise<ParserResultText[]|ParserResultBinary[]>>();
parserMap.set('mdx', parseMDXFile);

const getDictInfoMap = new Map<string, (buff: ArrayBuffer) => Promise<DictInfo>>();
getDictInfoMap.set('mdx', MDXGetDictInfo);

export async function getDictTitle(fileType: string, buff: ArrayBuffer) {
    const getDictInfo = getDictInfoMap.get(fileType.toLocaleLowerCase());
    if (getDictInfo) {
        return await getDictInfo(buff);
    }
    throw new Error('Unsupported file type.');
}

export async function parse(fileType: string, buff: ArrayBuffer) {
    const parser = parserMap.get(fileType.toLocaleLowerCase());
    if (parser) {
        return await parser(buff);
    }
    throw new Error('Unsupported file type.');
}