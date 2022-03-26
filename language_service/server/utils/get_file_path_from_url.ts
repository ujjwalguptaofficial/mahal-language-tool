import { platform } from "os";
import { Utils, URI } from 'vscode-uri';

const IS_WINDOWS = platform() === 'win32';
export const getFilePathFromURL = (documentUri: string) => {
    if (IS_WINDOWS) {
        // Windows have a leading slash like /C:/Users/pine
        // vscode-uri use lower-case drive letter
        // https://github.com/microsoft/vscode-uri/blob/95e03c06f87d38f25eda1ae3c343fe5b7eec3f52/src/index.ts#L1017
        return URI.parse(documentUri).path.replace(/^\/[a-zA-Z]/, (s: string) => s.slice(1));
    } else {
        return URI.parse(documentUri).path;
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