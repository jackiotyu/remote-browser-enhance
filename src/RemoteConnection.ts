import SFTP from 'ssh2-sftp-client';
import {ConnConfig} from './ConnConfig';
import { FileNode } from './FileNode';
import * as fs from 'fs';
import {createHash} from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { logError, displayError, displayNotif, StatusBarItem } from './Common';
import { watch, FSWatcher } from 'chokidar';


export enum ConnectionStatus {
    Off,
    Connected,
    Disconnected
}


// Abstraction over ssh2-sftp-client
export class RemoteConnection extends SFTP {

    connection: Promise<void>;
    filter?: RegExp | undefined;
    config: vscode.WorkspaceConfiguration;
    // An event to fire after the connection is successful
    event?: vscode.EventEmitter<FileNode | void>;
    connStatus: ConnectionStatus = ConnectionStatus.Off;
    statusBar: StatusBarItem;

    fileWatcher?: FSWatcher;

    constructor(config: vscode.WorkspaceConfiguration, connectConfig: ConnConfig, event: vscode.EventEmitter<FileNode | void>,
        callback: () => void) {
        super();
        this.statusBar = new StatusBarItem();
        this.config = config;
        this.event = event;
        this.connection = this.conn(connectConfig, callback);
    }

    // Keep sftp session alive by sending dummy GET packets every 60 seconds
    private keepAlive() {
        setInterval(() => {
            if (this.connStatus === ConnectionStatus.Connected) {
                // The promise return value is useless.
                this.get('.').then(() => { }).catch((e) => { });
            }
        }, 60000);
    }

    dispose() {
        this.fileWatcher?.close();
    }

    private checkFileWatcher(dirPath: string) {
        if(this.fileWatcher) {return;}
        this.fileWatcher = watch(dirPath, {
            ignoreInitial: true,
            atomic: true
        });
        this.fileWatcher.on('change', (filePath) => {
            console.log('change file', filePath);
        });
    }

    private conn(connectConfig: ConnConfig, callback: () => void): Promise<void> {

        // Config may change
        this.config = vscode.workspace.getConfiguration('');

        let self = this;
        // Obtain the private key buffer
        let pkPath = connectConfig.privateKey ? String(connectConfig.privateKey) : undefined;
        let pkBuffer = pkPath ? fs.readFileSync(pkPath) : undefined;

        connectConfig.privateKey = pkBuffer;

        var connect_with_args = function (args: ConnConfig) {
            let connection = self.connect(connectConfig).then((res) => {
                self.connStatus = ConnectionStatus.Connected;
                self.keepAlive();
                self.event ? self.event.fire() : undefined;
                callback();
                displayNotif('Connected');
            }).catch((e) => {
                /* Check for an auth failure and prompt for password */
                if (e.level === 'client-authentication') {
                    vscode.window.showInputBox({ placeHolder: `Password for ${args.username}@${args.host}`, password: true }).then(pwd => {
                        if(pwd === undefined) {
                            return;
                        }
                        args.password = pwd;
                        connect_with_args(args);
                    });
                } else if (e.message && e.message.indexOf('no passphrase') > -1) {
                    vscode.window.showInputBox({ placeHolder: `Passphrase for Encrypted Key`, password: true }).then(pp => {
                        if(pp === undefined) {
                            return;
                        }
                        args.passphrase = pp;
                        connect_with_args(args);
                    });
                } else if(e.name === 'InvalidAsn1Error') {
                    displayError('Could not decrpyt private key. Please ensure passphrase is correct');
                    logError(e);
                } else {
                    displayError('Error in connection. Check console for details');
                    logError(e);
                }

            });
            return connection;
        };

        return connect_with_args(connectConfig);

    }

    public setFilter(regexQuery: string | undefined) {
        try {
            this.filter = regexQuery ? new RegExp(regexQuery) : undefined;
        }
        catch (e: any) {
            logError(e);
            displayError('Regex Error');
        }
    }



    /* sftp-ls on directory path*/
    public async get_list(dirPath?: FileNode) {
        let file_list: Array<SFTP.FileInfo> = [];
        try {
            file_list = await this.list(dirPath ? dirPath.remotePath : '.');
        }
        catch (e: any) {
            logError(e);
            displayError('Error in obtaining directory contents');
        }
        return file_list.filter((a) => this.filter ? this.filter.test(a.name) : true)
            .sort((a, b) => {
                let name1 = a.name.toLowerCase(), name2 = b.name.toLowerCase();
                // Default Sort option - Alphabetical and Folders first
                if(a.type === 'd' && b.type !== 'd') {
                    return -1;
                }
                if(b.type === 'd' && a.type !== 'd') {
                    return 1;
                }
                if (name1 < name2) {
                    return -1;
                }
                if (name1 > name2) {
                    return 1;
                }
                return 0;
            })
            .map((elem) => {
                return new FileNode(elem.name, elem.type === 'd', dirPath);
            });
    }

    private get_local_dir(remotePath: string) {

        // Create directory if it does not exist
        function createDir(dir: string) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir);
                }
            } catch (e: any) {
                displayError('Error in obtaining local Directory. Make sure path is correct.');
                logError(e);
            }
        }

        let conf_dir = this.config.get<string>('remoteBrowserEnhance.tmpFolder');
        if (!conf_dir) {
            conf_dir = path.join(os.tmpdir(), 'remote-browser-enhance');
            createDir(conf_dir);
        }
        else {
            createDir(conf_dir);
        }

        this.checkFileWatcher(conf_dir);

        /*  Use a hash of the remote path to create a local directory for a file.
            Ensures that no conflict occurs on different files with the same name */
        const loc_dir = createHash('md5').update(remotePath).digest('hex').slice(0, 4);
        conf_dir = conf_dir + '/' + loc_dir;
        createDir(conf_dir);
        return conf_dir;
    }

    /* sftp-get on file path. Returns a local file path containing contents of remote file */
    public async get_file(remotePath: string) {
        const filename = remotePath.split('/').slice(-1)[0];
        const localFilePath = path.join(this.get_local_dir(remotePath), filename);

        // Remove local file if it exists before getting remote file
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }

        try {
            // Create an empty file before append to handle empty chunks
            fs.closeSync(fs.openSync(localFilePath, 'w'));
            await this.fastGet(remotePath, localFilePath);
            /*
                Obsolete file read handling. Using the fastGet API Instead.

                var readChunk = () => {
                let chunk;
                    while (null !== (chunk = fileStream.read())) {
                        fs.appendFile(localFilePath, chunk, function (err) {
                            if (err) {
                                logError(err.message);
                                displayError('Error in Writing file to local path. Check console for details');
                            }
                        });
                    }
                };

                // Required because the file get API processes an on('readable') and resolves the promise
                // Subsequent readble events have to be handled through an event here
                readChunk();
                fileStream.on('readable', () => {
                    readChunk();
                });

            */
        }
        catch (e: any) {
            logError(e);
            displayError('Error in downloading file');
        }

        return localFilePath;
    }

    /* sftp-put on file path */
    public async put_file(remotePath: string, localPath: string) {
        this.statusBar.updateStatusBarProgress(`Saving file...`);
        this.put(localPath, remotePath, {}).then((res) => {
            console.log('File saved to ' + remotePath);
            this.statusBar.updateStatusBarSuccess(`Saved File successfully in remote`);
        }).catch((err) => {
            this.statusBar.hide();
            displayError('Error in saving file to remote. Check console for details');
            logError(err);
        });
    }
}