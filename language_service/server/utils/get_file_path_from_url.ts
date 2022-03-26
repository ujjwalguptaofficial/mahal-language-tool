import { platform } from "os";
import { URI } from 'vscode-uri';

const IS_WINDOWS = platform() === 'win32';
export const getFilePathFromURL = (documentUri: string) => {
    if (IS_WINDOWS) {
        // Windows have a leading slash like /C:/Users/pine
        // vscode-uri use lower-case drive letter
        // https://github.com/microsoft/vscode-uri/blob/95e03c06f87d38f25eda1ae3c343fe5b7eec3f52/src/index.ts#L1017
        return URI.parse(documentUri).fsPath.replace(/\\/g, '/');
    } else {
        return URI.parse(documentUri).fsPath;
    }
}
export const getURLFromPath = (fsPath: string) => {
    try {
        return URI.file(fsPath).toString();
        // pathToFileURL(value).toString();
    } catch (error) {

    }
    return fsPath;
}