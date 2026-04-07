import axios from "axios";

// async function getRedirectUrl(url: string): Promise<string> {
//   const res = await fetch(url, { redirect: "follow" });
//   return res.url;
// }

export async function versionGetter(importPath: string): Promise<string[]> {
  // let segment = importPath.split("/").splice(0, 2).join("/");
  var proxyUrl = `https://proxy.golang.org/github.com/${importPath}/@v/list`;
  try {
    const response = await axios.get(proxyUrl, {
      headers: {
        Accept: "text/plain",
      },
    });
    const filteredVersion: string[] = [];
    const versions = response.data.split("\n");
    for (var version of versions) {
      filteredVersion.push(version);
    }
    return filteredVersion;
  } catch (err: any) {
    console.error("Failed to fetch versions:", err.message);
    return [];
  }
}

export async function doesSubpkgExist(
  importUrl: string,
  version: string
): Promise<boolean> {
  const splittedUrl = splitUrl(importUrl);
  const url = `https://pkg.go.dev/${splittedUrl.modulePath}/${splittedUrl.subPath}?tab=doc@${version}`;
  const res = await fetch(url, { method: "HEAD" });
  return res.status === 200;
}

function splitUrl(importUrl: string): {
  modulePath: string | null;
  subPath: string | null;
} {
  const parts = importUrl.split("/");
  if (parts.length < 2) {
    return { modulePath: null, subPath: null };
  }

  const moduleRoot = parts.slice(0, 2).join("/");
  const subUrl = parts.length > 2 ? parts.slice(2).join("/") : null;
  return { modulePath: moduleRoot, subPath: subUrl };
}
