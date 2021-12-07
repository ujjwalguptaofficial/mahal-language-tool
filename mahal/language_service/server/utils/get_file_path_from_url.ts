import { URL } from "url"

export const getFilePathFromURL = (value: string) => {
    try {
        const url = new URL(value);
        return url.pathname;
    } catch (error) {

    }
    return value;
}