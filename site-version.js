﻿window.SITE_VERSION = "20260506-0632";

(function () {
  function isExternalHref(url) {
    return /^(?:[a-z]+:|\/\/|#)/i.test(String(url || ""));
  }

  function withSiteVersion(url) {
    var raw = String(url || "");
    if (!raw || isExternalHref(raw)) return raw;
    if (/[?&]v=/.test(raw)) return raw;

    var hashIndex = raw.indexOf("#");
    var hash = "";
    var base = raw;
    if (hashIndex >= 0) {
      hash = raw.slice(hashIndex);
      base = raw.slice(0, hashIndex);
    }

    var sep = base.indexOf("?") >= 0 ? "&" : "?";
    return base + sep + "v=" + encodeURIComponent(window.SITE_VERSION) + hash;
  }

  function applySiteVersion(root) {
    var target = root || document;

    target.querySelectorAll('a[href]').forEach(function (el) {
      var href = el.getAttribute("href");
      if (!href || !/\.html(?:$|[?#])/i.test(href)) return;
      el.setAttribute("href", withSiteVersion(href));
    });

    target.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      var href = el.getAttribute("href");
      if (!href || href.indexOf("styles.css") === -1) return;
      el.setAttribute("href", withSiteVersion(href));
    });
  }

  window.withSiteVersion = withSiteVersion;
  window.applySiteVersion = applySiteVersion;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      applySiteVersion(document);
    });
  } else {
    applySiteVersion(document);
  }
})();

