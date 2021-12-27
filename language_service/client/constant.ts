import { window } from "vscode";
export const appName = "mahal-language-tool";
//Create output channel
export const appOutputChannel = window.createOutputChannel(appName);

export const logger = {
    log(...message) {
        let string = "";
        message.forEach((msg, index) => {
            string += JSON.stringify(msg);
            if (index != 0) {
                string += ", ";
            }
        })
        appOutputChannel.appendLine(string);
    }
}