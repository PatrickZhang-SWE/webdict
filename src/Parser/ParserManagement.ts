import { type ParserResultText, type ParserResultBinary } from './ParserResult.js'
import { parse as parseMDXFile } from './MDXParser.js'
const parserMap = new Map<string, (buff: ArrayBuffer) => Promise<ParserResultText[]|ParserResultBinary[]>>();
parserMap.set('mdx', parseMDXFile);

export async function parse(fileType: string, buff: ArrayBuffer) {
    const parser = parserMap.get(fileType.toLocaleLowerCase());
    if (parser) {
        return await parser(buff);
    }
    throw new Error('Unsupported file type.');
}