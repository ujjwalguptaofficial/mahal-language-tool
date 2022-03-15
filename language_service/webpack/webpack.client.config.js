const path = require('path')

exports.default = {
    mode: "development",
    // mode:,
    // devtool: 'source-map',
    entry: `./client/index.ts`,
    target: 'node',
    output: {
        path: path.join(__dirname, "./../dist"),
        filename: `client.js`,
        library: 'mahal_language_client',
        libraryTarget: 'commonjs2',
    },
    externals: {
        vscode: 'vscode',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        modules: [path.resolve(__dirname, 'src'), 'node_modules'],
        extensions: ['.json', '.js', '.ts', 'tsx'],
        alias: {
            // "@": path.resolve(__dirname, "./src")
        },
    },
    plugins: [

    ],

}