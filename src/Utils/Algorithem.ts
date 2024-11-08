import { createAdler32 } from 'hash-wasm'
import { flipArrayEndianness } from './Endianness.js'

async function adler32Cal(buff: Uint8Array) {
    const adler32Instance = await createAdler32()
    adler32Instance.init();
    adler32Instance.update(buff);
    const signarure = adler32Instance.digest('binary').buffer;
    return Buffer.from(flipArrayEndianness(signarure)).toString('hex');
}

export { adler32Cal }