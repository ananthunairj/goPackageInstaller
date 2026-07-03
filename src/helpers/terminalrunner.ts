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

async function getCanonicalModulePath(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await exec(`go mod download -json github.com/${repoPath}@latest`, {
      cwd: getCommandWorkingDirectory(),
      maxBuffer: 1024 * 1024,
    });

    const info = JSON.parse(stdout);
    // Extract the actual module path from go.mod
    return info?.Path?.replace("github.com/", "") || null;
  } catch (error: any) {
    return null;
  }
}

function extractCanonicalPathFromError(errorMessage: string): string | null {
  // Extract from error: "module declares its path as: github.com/moby/moby/client but was required as: ..."
  const match = errorMessage.match(/module declares its path as:\s*github\.com\/([^\s]+)\s+but was required/);
  return match?.[1] || null;
}

export async function terminalExecutor(
  repoPath: string,
  version: string | null
) {
  const cwd = getCommandWorkingDirectory();
  let actualRepoPath = repoPath;
  let attempts = 0;
  const maxAttempts = 2;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Installing github.com/${repoPath}`,
      cancellable: false,
    },
    async (progress) => {
      while (attempts < maxAttempts) {
        attempts++;
        const moduleRef = `github.com/${actualRepoPath}`;
        const command = version
          ? `go get ${moduleRef}@${version}`
          : `go get -u ${moduleRef}`;
        const desiredRef = version ? `${moduleRef}@${version}` : moduleRef;

        progress.report({ message: `Downloading package... (attempt ${attempts})` });

        try {
          await exec(command, { cwd, maxBuffer: 1024 * 1024 });

          // Success - verify download
          progress.report({ message: "Verifying download..." });
          const downloaded = await verifyModuleDownloaded(desiredRef, cwd);
          if (!downloaded) {
            vscode.window.showErrorMessage(`Package was not downloaded: ${desiredRef}`);
            return;
          }

          // Success - add import
          progress.report({ message: "Adding import to current file..." });
          await importWriter(actualRepoPath);
          
          if (actualRepoPath !== repoPath) {
            vscode.window.showInformationMessage(
              `Package installed successfully!\nPath was corrected: ${repoPath} → ${actualRepoPath}`
            );
          } else {
            vscode.window.showInformationMessage(`Package installed and import added: ${moduleRef}`);
          }
          return;
        } catch (error: any) {
          const errorText = error?.stderr || error?.message || "go get failed";
          
          // Try to extract canonical path from error
          const canonicalPath = extractCanonicalPathFromError(errorText);
          
          if (canonicalPath && canonicalPath !== actualRepoPath && attempts < maxAttempts) {
            // Path mismatch detected - retry with canonical path
            vscode.window.showInformationMessage(`Detected path redirect: retrying with ${canonicalPath}`);
            actualRepoPath = canonicalPath;
            continue;
          }

          // No recovery possible - show error
          const message = trimError(errorText);
          vscode.window.showErrorMessage(`Go package installation failed: ${message}`);
          return;
        }
      }
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
  if (!doc.uri.fsPath.endsWith(".go")) {
    vscode.window.showErrorMessage("Current file is not a Go file.");
    return;
  }

  const text = doc.getText();
  const importPath = `github.com/${url}`;

  // Verify package statement exists
  const packageMatch = text.match(/^package\s+\w+/m);
  if (!packageMatch) {
    vscode.window.showErrorMessage("No 'package' statement found.");
    return;
  }

  // Check if import already exists to avoid duplicates
  if (text.includes(`"${importPath}"`)) {
    vscode.window.showInformationMessage(`Import "${importPath}" already exists.`);
    return;
  }

  const edit = new vscode.WorkspaceEdit();
  const importIndent = "\t";
  const importEntry = `${importIndent}"${importPath}"`;

  // Try to find existing multi-line import block: import (...) 
  const multiLineImportMatch = text.match(/import\s*\(([\s\S]*?)\)/);
  if (multiLineImportMatch) {
    // Add to existing multi-line import block
    const blockEnd = multiLineImportMatch.index! + multiLineImportMatch[0].length - 1;
    const insertPosition = doc.positionAt(blockEnd);
    edit.insert(doc.uri, insertPosition, `\n${importEntry}`);
  } else {
    // Try to find single-line import: import "package"
    const singleLineImportMatch = text.match(/import\s+"[^"]+"/);
    if (singleLineImportMatch) {
      // Convert single import to multi-line and add new import
      const matchStart = doc.positionAt(singleLineImportMatch.index!);
      const matchEnd = doc.positionAt(singleLineImportMatch.index! + singleLineImportMatch[0].length);
      const existingImport = singleLineImportMatch[0].match(/"([^"]+)"/)?.[1] || "";
      
      const multilineBlock = `import (\n${importIndent}"${existingImport}"\n${importEntry}\n)`;
      edit.replace(doc.uri, new vscode.Range(matchStart, matchEnd), multilineBlock);
    } else {
      // No import exists - create new block after package declaration
      const packageEnd = doc.positionAt(packageMatch.index! + packageMatch[0].length);
      const newImportBlock = `\n\nimport (\n${importEntry}\n)`;
      edit.insert(doc.uri, packageEnd, newImportBlock);
    }
  }

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`Added import "${importPath}"`);
}
