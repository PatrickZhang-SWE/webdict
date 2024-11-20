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

const keywordIndexMeta = {
    numOfEntriesBytes: 8,
    firstWordSizeBytes: 2,
    lastWordSizeBytes: 2,
    compressedSizeBytes: 8,
    decompressedSizeBytes: 8,
}

interface CompressionItem {
    compType: number,
    checksum: ArrayBuffer,
    compressedData: ArrayBuffer
}

interface KeyIndexItem {
    numberOfEntries: number,
    firstWordSize: number,
    firstWord: string,
    lastWordSize: number,
    lastWord: string,
    compressedSize: number,
    decompressedSize: number,
}

interface KeyBlockItem {
    offset: number,
    key: string,
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
    const keyIndexActualLength = keyIndexEncrypted ? Number(lengthOfKeyIndexComp) : Number(lengthOfKeyIndexDecop);
    const keyIndex = await parseKeywordIndex(buff.slice(checksumLastByte, checksumLastByte + keyIndexActualLength), headerMeta.Encoding.toLocaleLowerCase() as BufferEncoding, Number(lengthOfKeyIndexDecop),  keyIndexEncrypted);
    if (Number(numberOfBlocks) !== keyIndex.length) {
        console.log(`The number of blocks in head meat is ${numberOfBlocks}, but the number of blocks in key index is ${keyIndex.length}.`);
        throw new Error(`The number of blocks in head meat is ${numberOfBlocks}, but the number of blocks in key index is ${keyIndex.length}.`);
    }
    let offset = checksumLastByte + keyIndexActualLength;
    const keywordResult: KeyBlockItem[] = [];
    for (const item of keyIndex) {
        const keyBlockCompSize = item.compressedSize;
        const keyBlockDecompSize = item.decompressedSize;
        const keyBlockBuff = buff.slice(offset, offset + keyBlockCompSize);
        offset += keyBlockCompSize;
        const keyblockResult = await parseKeyBlock(keyBlockBuff, keyBlockDecompSize, headerMeta.Encoding.toLocaleLowerCase() as BufferEncoding);
        keywordResult.push(...keyblockResult);
    }
    if (Number(numberOfEntries) !== keywordResult.length) {
        console.log(`The number of entries in head meat is ${numberOfEntries}, but the number of entries in key block is ${keywordResult.length}.`);
        throw new Error(`The number of entries in head meat is ${numberOfEntries}, but the number of entries in key block is ${keywordResult.length}.`);
    }
    return keywordResult;
}

async function parseKeywordIndex(buff: ArrayBuffer, encoding: BufferEncoding, decompressedSize: number,  encrypted: boolean = false) {
    const compressionItem = generateCompresssionItem(buff);
    const checksumBytes = compressionItem.checksum;
    const storedAdler32Value = Buffer.from(checksumBytes).toString('hex');
    let compressedData = compressionItem.compressedData;
    if (encrypted) {
        const keyBytes = new Uint8Array(compressionMeta.checksumLength + 4);
        keyBytes.set(new Uint8Array(checksumBytes));
        keyBytes.set([+'0x95', +'0x36', +'0x00', +'0x00'], compressionMeta.checksumLength);
        const decryptKey = ripemd128(keyBytes);
        compressedData = decryptMDXKeyIndex(compressedData, decryptKey.buffer);
    }
    const compType = compressionItem.compType;
    const decompressedData = await decompress(compressedData, compType);
    const checkSum = await calKeyIndexChecksum(decompressedData, compressedData, compType);
    if (checkSum !== storedAdler32Value) {
        console.log('cal: %s, store: %s', checkSum, storedAdler32Value);
        throw new Error("keyword index checksum is not validated.");
    }
    let baseIndex = 0;
    let keyIndexInfo: KeyIndexItem[] = [];
    const wordWidth = widthOfEncoding(encoding);
    while (baseIndex < decompressedSize) {
        const numOfEntries = readAsBigEndianBigInt(decompressedData.slice(baseIndex, baseIndex + keywordIndexMeta.numOfEntriesBytes));
        baseIndex += keywordIndexMeta.numOfEntriesBytes;
        const firstWordSize = readAsBigEndianNumber(decompressedData.slice(baseIndex, baseIndex + keywordIndexMeta.firstWordSizeBytes));
        baseIndex += keywordIndexMeta.firstWordSizeBytes;
        const firstWord = Buffer.from(decompressedData.slice(baseIndex, baseIndex + firstWordSize * wordWidth)).toString(encoding);
        baseIndex += firstWordSize * wordWidth + wordWidth;
        const lastWordSize= readAsBigEndianNumber(decompressedData.slice(baseIndex, baseIndex + keywordIndexMeta.lastWordSizeBytes));
        baseIndex += keywordIndexMeta.lastWordSizeBytes;
        const lastWord = Buffer.from(decompressedData.slice(baseIndex, baseIndex + lastWordSize * wordWidth)).toString(encoding);
        console.log("last word is: %s", lastWord);
        baseIndex += lastWordSize * wordWidth + wordWidth;
        const compSize = readAsBigEndianBigInt(decompressedData.slice(baseIndex, baseIndex + keywordIndexMeta.compressedSizeBytes));
        baseIndex += keywordIndexMeta.compressedSizeBytes;
        const decompSize = readAsBigEndianBigInt(decompressedData.slice(baseIndex, baseIndex + keywordIndexMeta.decompressedSizeBytes));
        baseIndex += keywordIndexMeta.decompressedSizeBytes;
        console.log("kwyword start from %s, end at %s, baseIndex: %d", firstWord, lastWord, baseIndex);
        keyIndexInfo.push({
            numberOfEntries: Number(numOfEntries),
            firstWordSize: firstWordSize,
            firstWord: firstWord,
            lastWordSize: lastWordSize,
            lastWord: lastWord,
            compressedSize: Number(compSize),
            decompressedSize: Number(decompSize),
        })
    }
    return keyIndexInfo;
}

async function parseKeyBlock(buff: ArrayBuffer,decompressedSize: number, encoding: BufferEncoding) {
    const compressionItem = generateCompresssionItem(buff);
    const compType = compressionItem.compType;
    const decompressedData = await decompress(compressionItem.compressedData, compType);
    let offset = 0;
    const wordWidth = widthOfEncoding(encoding);
    const keyblockResult: KeyBlockItem[] = [];
    while (offset < decompressedSize) {
        const keyOffset = readAsBigEndianBigInt(decompressedData.slice(offset, offset + 8));
        offset += 8;
        let keyEndByte = offset;
        while (readAsBigEndianNumber(decompressedData.slice(keyEndByte, keyEndByte + wordWidth)) !== 0) {
            keyEndByte += wordWidth;
        }
        const key = Buffer.from(decompressedData.slice(offset, keyEndByte)).toString(encoding);
        console.log("key is: %s, offset is: %d", key, keyOffset);
        offset = keyEndByte + wordWidth;
        keyblockResult.push({
            offset: Number(keyOffset),
            key: key
        })
    }
    return keyblockResult;
}

function generateCompresssionItem(buff: ArrayBuffer): CompressionItem {
    const compTypeBytes = buff.slice(0, compressionMeta.compTypeLength);
    const checksumLastByte = compressionMeta.compTypeLength + compressionMeta.checksumLength;
    const checksumBytes = buff.slice(compressionMeta.compTypeLength, checksumLastByte);
    const compressedData = buff.slice(checksumLastByte);
    return {
        compType: readAsBigEndianNumber(compTypeBytes.slice(0, 1)),
        checksum: checksumBytes,
        compressedData
    }
}

async function calKeyIndexChecksum(decompressedData: ArrayBuffer, compressedData: ArrayBuffer, compType: number) {
    switch(compType) {
        case 0:
        case 1:
            return await adler32Cal(new Uint8Array(decompressedData), true);
        case 2:
            const buffLength = compressedData.byteLength;
            return Buffer.from(compressedData.slice(buffLength - 4)).toString('hex');
    }
    adler32Cal(new Uint8Array(compressedData), true);
}

function widthOfEncoding(encoding: BufferEncoding) {
    switch(encoding) {
        case 'utf8':
            return 1;
        case 'utf-8':
            return 1;
        case 'utf16le':
            return 2;
        case 'utf-16le':
            return 2;
    }
    throw new Error("Encoding is not supported");
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
        return (await util.promisify(zlib.unzip)(compressedData)).buffer;
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