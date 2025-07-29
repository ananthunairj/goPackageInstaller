import axios from "axios";
export function extractRepoPath(pkgUrl: string): string | null {
  const match = pkgUrl.match(/github\.com\/(.+)/);
  return match ? match[1] : null;
}

export async function getRepoStars(repoPath: string): Promise<any> {

  let segment = repoPath.split("/").splice(0,2).join("/");
  const url = `https://go-github-getter.anandhunairj.workers.dev/?repo=${segment}`;
   try {
      const res = await axios.get(url);
      return `⭐ ${res.data}`;
    } catch (err: any) {
      console.warn(
        `Github fetch failed in cloudfare worker for ${repoPath}`,
        err.message
      );
      return `⭐ 0`;
    }
  
}

// async function usedByGit(repoPath:string) : Promise<any> {
//   try {
//     const url = `https://github.com/${repoPath}`;
//     const res = await axios.get(url, {
//       headers: { "User-Agent": "Mozilla/5.0" },
//     });
//     const match = res.data.match(/href="\/[^/]+\/[^/]+\/network\/dependents[^"]*">.*?Used by\s*<.*?>([\d,]+)/i);
//     const count = match ? match[1].replace(/,/g, "") : "0";
//     return `🧩 ${count}`;
//   } catch (err : any) {
//     console.warn(`Failed to get import count for ${repoPath}:`, err.message);
//      console.log("Status:", err.response.status);
//   console.log("Data:", err.response.data);
//     return `🧩 0`;
//   }
//   }

