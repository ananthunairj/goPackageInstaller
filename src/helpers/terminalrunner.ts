import * as path from "path";
import * as vscode from "vscode";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { versionGetter } from "./version";

const exec = promisify(execCb);

export async function versionFinder(importPath: string) {
  if (importPath !== null) {
    return versionGetter(importPath);
  }
  return [];
}

export async function terminalExecutor(
  repoPath: string,
  version: string | null
) {
  const moduleRef = `github.com/${repoPath}`;
  const command = version
    ? `go get ${moduleRef}@${version}`
    : `go get -u ${moduleRef}`;
  const cwd = getCommandWorkingDirectory();
  const desiredRef = version ? `${moduleRef}@${version}` : moduleRef;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing ${moduleRef}`,
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Downloading package..." });

      try {
        await exec(command, { cwd, maxBuffer: 1024 * 1024 });
      } catch (error: any) {
        const message = trimError(error?.stderr || error?.message || "go get failed");
        vscode.window.showErrorMessage(`Go package installation failed: ${message}`);
        return;
      }

      progress.report({ message: "Verifying download..." });
      const downloaded = await verifyModuleDownloaded(desiredRef, cwd);
      if (!downloaded) {
        vscode.window.showErrorMessage(`Package was not downloaded: ${desiredRef}`);
        return;
      }

      progress.report({ message: "Adding import to current file..." });
      await importWriter(repoPath);
      vscode.window.showInformationMessage(`Package installed and import added: ${moduleRef}`);
    }
  );
}

function getCommandWorkingDirectory(): string {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspacePath) {
    return workspacePath;
  }

  const editorFile = vscode.window.activeTextEditor?.document.uri.fsPath;
  if (editorFile) {
    return path.dirname(editorFile);
  }

  return process.cwd();
}

async function verifyModuleDownloaded(importRef: string, cwd: string): Promise<boolean> {
  try {
    const { stdout } = await exec(`go list -m -json ${importRef}`, {
      cwd,
      maxBuffer: 1024 * 1024,
    });

    const info = JSON.parse(stdout);
    return Boolean(info?.Path && info?.Dir);
  } catch (error: any) {
    console.warn(`go list verification failed for ${importRef}:`, error?.stderr || error?.message);
    return false;
  }
}

function trimError(value: string): string {
  return value?.toString().trim().replace(/\s+/g, " ") || "Unknown error";
}

async function importWriter(url: string) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found.");
    return;
  }

  const doc = editor.document;
  const filePath = doc.uri.fsPath;

  if (!filePath.endsWith(".go")) {
    vscode.window.showErrorMessage("Current file is not a Go file.");
    return;
  }

  const text = doc.getText();
  const edit = new vscode.WorkspaceEdit();
  const importLine = `\t"github.com/${url}"\n`;

  const importBlockMatch = text.match(/import\s+\(([\s\S]*?)\)/);

  if (importBlockMatch) {
    const importStartIndex = importBlockMatch.index!;
    const importBlock = importBlockMatch[0];
    const insertPos = importStartIndex + importBlock.length - 1;
    const insertPosition = doc.positionAt(insertPos);
    edit.insert(doc.uri, insertPosition, importLine);
  } else {
    const packageMatch = text.match(/^package\s+\w+/m);
    if (!packageMatch) {
      vscode.window.showErrorMessage("No 'package' statement found.");
      return;
    }
    const packageEndPos = doc.positionAt(packageMatch.index! + packageMatch[0].length);
    const newImportBlock = `\n\nimport (\n${importLine})\n`;
    edit.insert(doc.uri, packageEndPos, newImportBlock);
  }

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`Added import "${url}"`);
}
