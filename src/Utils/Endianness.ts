function isLittleEndian(): boolean {
    // If the integer 0x00000001 is arranged in memory as 01 00 00 00
    // The bottom layer uses little-endian byte order. 
    // On big-endian platforms it should be 00 00 00 01
    return new Int8Array(new Int32Array([1]).buffer)[0] === 1
}

function readAsBigEndianNumber(buffer: ArrayBuffer): number {
    const size = buffer.byteLength;
    const dataView = new DataView(buffer);
    switch (size) {
        case 1:
            return dataView.getInt8(0);
        case 2:
            return dataView.getInt16(0, false);
        case 4:
            return dataView.getInt32(0, false);
    }
    throw new Error(`Unsupport size ${size}`);
}

function readAsBigEndianBigInt(buff: ArrayBuffer): bigint {
    const dataView = new DataView(buff);
    return dataView.getBigInt64(0, false);
}

function readAsLittleStr(buff: ArrayBuffer, format: string): string {
    const decoder = new TextDecoder(format);
    return decoder.decode(buff);
}

function readAsLittleNumber(buff: ArrayBuffer): number {
    return new DataView(buff).getInt32(0, true);
}

function flipArrayEndianness(buff: ArrayBuffer): ArrayBuffer {
    const length = buff.byteLength;
    const view = new DataView(buff);
    for (let i = 0, j = length - 1; i < j; i++, j--) {
        const tmp = view.getUint8(i);
        view.setUint8(i, view.getUint8(j));
        view.setUint8(j, tmp);
    }
    return view.buffer;
}

export { isLittleEndian, readAsBigEndianNumber, readAsLittleStr, readAsLittleNumber, flipArrayEndianness, readAsBigEndianBigInt }