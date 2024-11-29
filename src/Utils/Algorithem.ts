import { createAdler32 } from 'hash-wasm'
import { flipArrayEndianness } from './Endianness.js'
import { ripemd128 as ripemd128Cal }  from './ripemd128.js'

async function adler32Cal(buff: Uint8Array, bigEndian?: boolean) {
    const adler32Instance = await createAdler32()
    adler32Instance.init();
    adler32Instance.update(buff);
    const signarure = adler32Instance.digest('binary').buffer;
    if (bigEndian) {
        return Buffer.from(signarure).toString('hex');
    }
    return Buffer.from(flipArrayEndianness(signarure)).toString('hex');
}

function decryptMDXKeyIndex(buff: ArrayBuffer, decipher: ArrayBuffer) {
    let prev = +"0x36";
    const encryptDataLength = buff.byteLength;
    const decipherLength = decipher.byteLength;
    const encryptedView = new DataView(buff);
    const decipherView = new DataView(decipher);
    for (let i = 0; i < encryptDataLength; i++) {
        let tmp = encryptedView.getUint8(i);
        tmp = (tmp >> 4) | (tmp << 4);
        tmp = tmp ^ prev ^ (i & 0xff) ^ decipherView.getUint8(i % decipherLength);
        prev = encryptedView.getUint8(i);
        encryptedView.setUint8(i, tmp);
    }
    return encryptedView.buffer;
}

function ripemd128(buff: ArrayBuffer) {
    return ripemd128Cal(buff);
}


export { adler32Cal, decryptMDXKeyIndex, ripemd128 }