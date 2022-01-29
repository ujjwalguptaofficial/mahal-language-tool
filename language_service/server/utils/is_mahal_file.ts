const extension = ".mahal"
export const isMahalFile = (fileName: string) => {
    return fileName.includes(extension);
}

export function isVirtualMahalFilePath(filePath: string) {
    return filePath.endsWith(`${extension}.ts`);
}

export function toRealMahalFilePath(filePath: string) {
    return filePath.slice(0, -'.ts'.length);
}

export function getRealMahalFilePath(filePath: string) {
    return isVirtualMahalFilePath(filePath) ? toRealMahalFilePath(filePath) : filePath;
}
