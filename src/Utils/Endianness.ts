function isLittleEndian(): boolean {
    // If the integer 0x00000001 is arranged in memory as 01 00 00 00
    // The bottom layer uses little-endian byte order. 
    // On big-endian platforms it should be 00 00 00 01
    return new Int8Array(new Int32Array([1]).buffer)[0] === 1
}

function readAsBigEndianNumber(buffer: ArrayBuffer): number {
    const dataView = new DataView(buffer);
    return dataView.getUint32(0, false);
}

function readAsLittleStr(buff: ArrayBuffer, format: string): string {
    const decoder = new TextDecoder(format);
    return decoder.decode(buff);
}

export {isLittleEndian, readAsBigEndianNumber, readAsLittleStr}