'use strict';
import * as vscode from 'vscode';
import { logError, displayError, displayNotif } from './Common';
import {ConnConfig} from './ConnConfig';

import { RemoteFileTreeProvider } from './RemoteFileTreeProvider';

import { DnDController } from './DnDController';

// Quick pick item
class QPItem implements vscode.QuickPickItem {
    public label: string;
    public config: ConnConfig;
    constructor(config: ConnConfig) {
        this.label = config.username + '@' + config.host;
        this.config = config;
    }
}

export function activate(context: vscode.ExtensionContext) {
    let config = vscode.workspace.getConfiguration('');
    let remoteTree: RemoteFileTreeProvider = new RemoteFileTreeProvider(config);

    context.subscriptions.push(vscode.commands.registerCommand('remoteBrowserEnhance.disconnect', () => {
        remoteTree.endSession()
            .then(() => displayNotif('Disconnected'))
            .catch((e) => {
                displayError('Could not Disconnect');
                logError(e);
            });
    }));
    console.log('remote-browser-enhance is now active');

    // Register Connect Command
    let connCmd = vscode.commands.registerCommand('remoteBrowserEnhance.connect', () => {

        // Config may change
        config = vscode.workspace.getConfiguration('');

        let hosts: QPItem[] = [];
        let remoteBrowserEnhanceConnectionOptions: any = config.get('remoteBrowserEnhance.connectionOptions');
        let additionalConnections: Array<any> | undefined = config.get('remoteBrowserEnhance.additionalConnections');

        if(additionalConnections && additionalConnections.length > 0) {
            // Show quick pick if additional connections are configured
            hosts.push(new QPItem(remoteBrowserEnhanceConnectionOptions));
            additionalConnections.forEach((connectConfig: ConnConfig) => {
                hosts.push(new QPItem(connectConfig));
            });
            vscode.window.showQuickPick(hosts, {placeHolder: 'Select Configured connection'}).then(qp => {
                if(qp) {
                    remoteTree.connect(config, qp.config);
                }
            });
        }
        else {
            remoteTree.connect(config, remoteBrowserEnhanceConnectionOptions);
        }
    });

    // Register Path change Command
    let cpCmd = vscode.commands.registerCommand("remoteBrowserEnhance.changePath", (path: string) => {
        // If command is invoked by user, prompt for path
        if (!path) {
            vscode.window.showInputBox({ placeHolder: 'Enter Absolute Remote Path' }).then(p => {
                remoteTree.changePath(p ? p : '.');
            });
        }
        else {
            remoteTree.changePath(path);
        }

    });

    // Register Path change Command
    let opCmd = vscode.commands.registerCommand("remoteBrowserEnhance.openFile", (path: string) => {
        remoteTree.getFile(path);
    });

    // Register filter
    context.subscriptions.push(vscode.commands.registerCommand("remoteBrowserEnhance.filter", () => {
        vscode.window.showInputBox({ placeHolder: 'Enter Filter Regex. Leave blank to clear filter' }).then(p => {
            remoteTree.filter(p);
        });
    }));

    // Register makeRoot
    context.subscriptions.push(vscode.commands.registerCommand("remoteBrowserEnhance.makeRoot", (node: any) => {
        if(node) {
            // If target is a file, route to parent directory of the file
            remoteTree.changePath(node.isDir ? node.remotePath : node.parent.remotePath);
        }
    }));

    context.subscriptions.push(cpCmd);
    context.subscriptions.push(opCmd);
    context.subscriptions.push(connCmd);

    const remoteExplorer = vscode.window.createTreeView('remoteExplorer', {
        treeDataProvider: remoteTree,
        manageCheckboxStateManually: true,
        showCollapseAll: true,
        dragAndDropController: new DnDController()
    });

    context.subscriptions.push(remoteExplorer);
}

export function deactivate() {

}