/**
 * GitHub Pages 프로젝트 사이트(user.github.io/repo/…)에서
 * 동일 출처 JSON이 배포·CDN 지연으로 오래될 때, GitHub 기본 브랜치의
 * 최신 파일(jsDelivr)과 병렬로 받아 비교할 수 있도록 URL을 만듭니다.
 * (로컬·file·커스텀 도메인에서는 null을 반환합니다.)
 */
(function (global) {
  function parseProject() {
    var loc = global.location;
    if (!loc || loc.protocol === "file:") return null;
    var host = String(loc.hostname || "").toLowerCase();
    if (!/\.github\.io$/i.test(host)) return null;
    var user = host.replace(/\.github\.io$/i, "");
    if (!user) return null;
    var parts = String(loc.pathname || "/").split("/").filter(Boolean);
    if (!parts.length) return null;
    var repo = parts[0];
    if (!repo) return null;
    return { user: user, repo: repo };
  }

  function metaBranch() {
    try {
      var m = global.document && global.document.querySelector('meta[name="yds-github-branch"]');
      if (m) {
        var c = String(m.getAttribute("content") || "").trim();
        if (c) return c;
      }
    } catch (e) {}
    return "main";
  }

  /**
   * @param {string} relativePath 예: "data/us-close-snapshot.json"
   * @returns {string|null}
   */
  function ydsJsDelivrRepoDataUrl(relativePath) {
    var p = parseProject();
    if (!p) return null;
    var f = String(relativePath || "").replace(/^\//, "");
    if (!f) return null;
    var branch = metaBranch();
    return "https://cdn.jsdelivr.net/gh/" + p.user + "/" + p.repo + "@" + branch + "/" + f;
  }

  global.ydsJsDelivrRepoDataUrl = ydsJsDelivrRepoDataUrl;
})(typeof window !== "undefined" ? window : this);
