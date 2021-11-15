export function getRangeFromXmlNode(src, tag) {
    let startIndex = src.indexOf(`<${tag}`);
    src = src.substring(startIndex);
    let start, endIndex;
    if (startIndex >= 0) {
        start = startIndex + src.indexOf(">");
        endIndex = startIndex + src.indexOf(`</${tag}>`);
    };
    return { start: start + 1, end: endIndex };
}

export function getContentFromXmlNode(src, tag) {
    const range = getRangeFromXmlNode(src, tag);
    return src.substring(range.start, range.end);
}