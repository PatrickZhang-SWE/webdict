import { type ParserResultText } from './ParserResult.js'
import { readAsBigEndianNumber, readAsLittleStr, readAsLittleNumber, readAsBigEndianBigInt } from '../Utils/Endianness.js'
import { adler32Cal, decryptMDXKeyIndex, ripemd128 } from '../Utils/Algorithem.js'
import { parseXml } from '../Utils/XMLUtil.js'
import { type HeaderXmlObject } from '../common/MDXEntities.js'
import * as zlib from 'zlib'
import * as util from 'util'

const headerSectMeta = {
    length: 4,
    headerStrEncode: "UTF-16LE",
    checkSum: 4,
}

const keywordSectMeta = {
    numBlocksLength: 8,
    numEntrieslength: 8,
    keyIndexDecopLength: 8,
    keyIndexCmpLength: 8,
    keyBlocksLength: 8,
    checksumLength: 4,
}

const compressionMeta = {
    compTypeLength: 4,
    checksumLength: 4,
}

async function parse(buff: ArrayBuffer) {
    const totalLength = buff.byteLength;
    if (totalLength <= 0) {
        return [];
    }
    const headerSectLengthPart = buff.slice(0, headerSectMeta.length);
    const headerStrLength = readAsBigEndianNumber(headerSectLengthPart);
    const headerLength = headerSectMeta.length + headerStrLength + headerSectMeta.checkSum;
    const headerObject = await parseHeaderSect(buff.slice(0, headerLength), headerStrLength, headerLength);
    const keyWordSectPart = buff.slice(headerLength);
    await parseKeyWordSect(keyWordSectPart, headerObject);
    return new Array();
}

async function parseHeaderSect(buff: ArrayBuffer, headerStrLength: number, length: number) {
    const headerStrBuff = buff.slice(headerSectMeta.length, headerStrLength + headerSectMeta.length);
    const calAdler32Value = await adler32Cal(new Uint8Array(headerStrBuff));
    const storeAdler32Value = Buffer.from(buff.slice(headerStrLength + headerSectMeta.length, headerStrLength + headerSectMeta.length + 4)).toString('hex');
    if (calAdler32Value !== storeAdler32Value) {
        console.log('cal: %s, store: %s', calAdler32Value, storeAdler32Value);
        throw new Error("HeaderStr checksum is not validated.");
    }
    const headerStr = readAsLittleStr(headerStrBuff, headerSectMeta.headerStrEncode);
    const parsedXml = parseXml(headerStr);
    return convertParsedHeaderStr(parsedXml.Dictionary);
}

async function parseKeyWordSect(buff: ArrayBuffer, headerMeta: HeaderXmlObject) {
    const numberOfBlocks = readAsBigEndianBigInt(buff.slice(0, keywordSectMeta.numBlocksLength));
    const entriesLastByte = keywordSectMeta.numBlocksLength + keywordSectMeta.numEntrieslength;
    const numberOfEntries = readAsBigEndianBigInt(buff.slice(keywordSectMeta.numBlocksLength, entriesLastByte));
    const keyIndexDecopLenLastByte = entriesLastByte + keywordSectMeta.keyIndexDecopLength;
    const lengthOfKeyIndexDecop = readAsBigEndianBigInt(buff.slice(entriesLastByte, keyIndexDecopLenLastByte));
    const keyIndexCompLenLastByte = keyIndexDecopLenLastByte + keywordSectMeta.keyIndexCmpLength;
    const lengthOfKeyIndexComp = readAsBigEndianBigInt(buff.slice(keyIndexDecopLenLastByte, keyIndexCompLenLastByte));
    const keyBlocksLenLastByte = keyIndexCompLenLastByte + keywordSectMeta.keyBlocksLength;
    const lengthOfKeyBlocks = readAsBigEndianBigInt(buff.slice(keyIndexCompLenLastByte, keyBlocksLenLastByte));
    const checksumLastByte = keyBlocksLenLastByte + keywordSectMeta.checksumLength;
    const checksumBytes = buff.slice(keyBlocksLenLastByte,checksumLastByte);
    const storeAdler32Value = Buffer.from(checksumBytes).toString('hex');
    const calAdler32Value = await adler32Cal(new Uint8Array(buff.slice(0, keyBlocksLenLastByte)), true);
    if (storeAdler32Value !== calAdler32Value) {
        console.log('cal: %s, store: %s', calAdler32Value, storeAdler32Value);
        throw new Error("keyword sect checksum is not validated.");
    }
    const encryptIndictor = headerMeta.Encrypted;
    if (isNaN(+encryptIndictor)) {
        console.log(`The ${encryptIndictor} is not a number.`);
        throw new Error(`Encrypted in head Meat is not a number`);
    }
    const encryptedHeadValue = +encryptIndictor;
    if (encryptedHeadValue & 0b01) {
        console.log("This dict is encrypted, and is not supported now.");
        throw new Error("Encrypted dicts are not supported");
    }
    const keyIndexEncrypted: boolean = Boolean(encryptedHeadValue & 0b10);
    await parseKeywordIndex(buff.slice(checksumLastByte, checksumLastByte + (keyIndexEncrypted ? Number(lengthOfKeyIndexComp) : Number(lengthOfKeyIndexDecop))), headerMeta, keyIndexEncrypted);
}

async function parseKeywordIndex(buff: ArrayBuffer, headerMeta: HeaderXmlObject, encrypted: boolean = false) {
    const compTypeBytes = buff.slice(0, compressionMeta.compTypeLength);
    const checksumLastByte = compressionMeta.compTypeLength + compressionMeta.checksumLength;
    const checksumBytes = buff.slice(compressionMeta.compTypeLength, checksumLastByte);
    const calAdler32Value = await adler32Cal(new Uint8Array(checksumBytes), true);
    let compressedData = buff.slice(checksumLastByte);
    if (encrypted) {
        const key = calAdler32Value + "\x95\x36\x00\x00";
        const decryptKey = ripemd128(key);
        compressedData = decryptMDXKeyIndex(compressedData, decryptKey);
    }
    const compType = readAsBigEndianNumber(compTypeBytes.slice(0, 1));
    const decompressedData = await decompress(compressedData, compType);
    const numberOfKeywords = readAsBigEndianBigInt(decompressedData.slice(0, 8));
    const lengthOfFirstKeyword = readAsBigEndianNumber(decompressedData.slice(8, 10));
}

async function decompress(compressedData: ArrayBuffer, compressType: number) {
    if (compressType === 0) {
        console.log("No compression.");
        return compressedData;
    }
    if (compressType === 0x01) {
        console.log("LZO compression is used.");
        throw new Error("LZO compression is not supported");
    }
    if (compressType === 0x02) {
        console.log("zlib compression is used.");
        return (await util.promisify(zlib.unzip)(compressedData.slice(4))).buffer;
    }
    throw new Error("LZO compression is not supported");
}

function convertParsedHeaderStr(parsedXml: any): HeaderXmlObject {
    return {
        GeneratedByEngineVersion: parsedXml['@_GeneratedByEngineVersion'],
        RequiredEngineVersion: parsedXml['@_RequiredEngineVersion'],
        Encrypted: parsedXml['@_Encrypted'],
        Encoding: parsedXml['@_Encoding'],
        Format: parsedXml['@_Format'],
        CreationDate: parsedXml['@_CreationDate'],
        Compact: parsedXml['@_Compact'],
        Compat: parsedXml['@_Compat'],
        KeyCaseSensitive: parsedXml['@_KeyCaseSensitive'],
        Description: parsedXml['@_Description'],
        Title: parsedXml['@_Title'],
        DataSourceFormat: parsedXml['@_DataSourceFormat'],
        StyleSheet: parsedXml['@_StyleSheet'],
        RegisterBy: parsedXml['@_RegisterBy'],
        RegCode: parsedXml['@_RegCode'],
        StripKey: parsedXml['@_StripKey'],
    }
}

export { parse }