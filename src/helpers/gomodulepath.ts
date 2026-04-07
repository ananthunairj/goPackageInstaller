import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import util from 'util';
import { exec } from 'child_process';




const execAsync = util.promisify(exec);

export async function getsafeGomodulePath(importpath:string) : Promise<string>{
   const resolved = await resolveModuleviaTemporaryGoMod(importpath);
   if(resolved) {
    return resolved;
   }
   console.warn(`Fallback: using guessed module path for "${importpath}"`);
   return guessGoModulePath(importpath);
    
}

async function resolveModuleviaTemporaryGoMod(importpath:string)  : Promise<string | undefined>{
    const tempdir = await fs.mkdtemp(path.join(os.tmpdir(), 'gomod-'));

    try {
        const goModPath = path.join(tempdir, 'go.mod');
        await fs.writeFile(goModPath, 'module tempmod\n');
        const {stdout } = await execAsync(`go  list -m -json ${importpath}`, {cwd: tempdir});
        const parsed = JSON.parse(stdout);
        return parsed?.Path;
    } catch(err : any) {
        console.error(`go list failed for ${importpath}`, err.message);
        return undefined;
    } finally {
        await fs.rm(tempdir, {recursive: true, force: true});
    }
}


function guessGoModulePath(importpath: string ) : string {
    const match = importpath.match(/^github\.com\/[^/]+\/[^/]+/);
    return match ? match[0] : importpath;
}