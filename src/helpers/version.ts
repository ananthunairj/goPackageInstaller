import axios from "axios";


async function getRedirectUrl(url : string) {
    const res = await fetch(url,{redirect : "follow"});
    return res.url;
}




export async function versionGetter(importPath: string): Promise<string[]> {
  let segment = importPath.split("/").splice(0, 2).join("/");
  var proxyUrl = `https://proxy.golang.org/github.com/${segment}/@v/list`;
  try {
    const response = await axios.get(proxyUrl, {
      headers: {
        Accept: "text/plain",
      },
    });
    const filteredVersion: string[] = [];
    const versions = response.data.split("\n");
    var regex = /^v\d+\.\d+\.\d+$/g;
    for (var version of versions) {
     let result : boolean = regex.test(version);
     if (result) {
      filteredVersion.push(version);
     }
    }
    return filteredVersion;
  } catch (err: any) {
    console.error("Failed to fetch versions:", err.message);
    return [];
  }
}
