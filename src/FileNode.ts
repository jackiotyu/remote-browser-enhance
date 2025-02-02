import { TreeItem, TreeItemCollapsibleState, ThemeIcon, Uri } from 'vscode';

// Tree Item representing a remote file or directory
export class FileNode extends TreeItem {
    fileStream?: Promise<NodeJS.ReadableStream>;
    remotePath: string;
    isDir: boolean;
    parent: FileNode | undefined;

    constructor(filename: string, isDir: boolean, parent: FileNode | undefined) {
        super(filename);
        this.parent = parent;
        if(parent) {
            const parent_root = parent ? parent.remotePath : '.';
            this.remotePath = parent_root + '/' + filename;
        }
        else {
            this.remotePath = filename;
        }

        this.tooltip = this.remotePath;

        this.isDir = isDir;
        this.resourceUri = Uri.parse(filename);
        this.contextValue = this.isDir ? 'remoteExplorer.Dir' : 'remoteExplorer.File';
        this.collapsibleState = isDir ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None;
        this.iconPath = this.isDir ? ThemeIcon.Folder : ThemeIcon.File;
        // Associate a change in tree root path with ..
        if (filename === '..') {
            this.command = {
                command: 'remoteBrowserEnhance.changePath',
                title: 'Change Path',
                arguments: [this.remotePath]
            };
        }

        // Associate a file GET with document opening
        else if(!isDir) {
            this.iconPath = ThemeIcon.File;
            this.command = {
                command: 'remoteBrowserEnhance.openFile',
                title: 'Change Path',
                arguments: [this.remotePath]
            };
        }
    }
}
