import { pathToFileURL, URL } from "url"

export const getFilePathFromURL = (value: string) => {
    try {
        const url = new URL(value);
        return url.pathname;
    } catch (error) {

    }
    return value;
}
export const getURLFromPath = (value: string) => {
    try {
        return pathToFileURL(value).toString();
    } catch (error) {

    }
    return value;
}