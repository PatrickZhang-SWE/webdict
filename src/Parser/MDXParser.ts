import { type ParserResultText } from './ParserResult.js'
import { readAsBigEndianNumber, readAsLittleStr } from '../Utils/Endianness.js'
function parse(buff: ArrayBuffer): Array<ParserResultText> {
    const totalLength = buff.byteLength;
    if (totalLength <= 0) {
        return [];
    }
    const headerSect = buff.slice(0, 4);
    const headerLength = readAsBigEndianNumber(headerSect);
    let headerStr = readAsLittleStr(buff.slice(5, headerLength + 5), "UTF-16LE");
    return new Array();
}