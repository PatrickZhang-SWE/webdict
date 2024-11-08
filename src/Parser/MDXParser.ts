import { type ParserResultText } from './ParserResult.js'
import { readAsBigEndianNumber, readAsLittleStr, readAsLittleNumber } from '../Utils/Endianness.js'
import { adler32Cal } from '../Utils/Algorithem.js'

const headerSectMeta = {
    length: 4,
    headerStrEncode: "UTF-16LE",
    checkSum: 4,
}

async function parse(buff: ArrayBuffer) {
    const totalLength = buff.byteLength;
    if (totalLength <= 0) {
        return [];
    }
    const headerSect = buff.slice(0, headerSectMeta.length);
    const headerLength = readAsBigEndianNumber(headerSect);
    const headerStrBuff = buff.slice(headerSectMeta.length, headerLength + headerSectMeta.length);
    const calAdler32Value = await adler32Cal(new Uint8Array(headerStrBuff));
    const storeAdler32Value = Buffer.from(buff.slice(headerLength + headerSectMeta.length, headerLength + headerSectMeta.length + 4)).toString('hex');
    console.log('cal: %s, store: %s', calAdler32Value, storeAdler32Value);
    const headerStr = readAsLittleStr(headerStrBuff, headerSectMeta.headerStrEncode);
    console.log("header_str: %s", headerStr);
    return new Array();
}

export { parse }