#!/usr/bin/env python3
"""
9대 패닉 지수 중 자동 갱신 가능한 행만 업데이트하고 panic-data.json / panic-data.js에 반영합니다.

- yfinance: VIX, SKEW, MOVE, VXN (^VIX, ^SKEW, ^MOVE, ^VXN)
- FRED HY 스프레드 (BAMLH0A0HYM2): fredgraph.csv (urllib, Node 스크립트와 동일 계열)
- CNN Fear & Greed: 로컬/일부 IP에서 urllib이 418이 나는 경우가 있어, `scripts/patch-fng-from-cnn.mjs`(Node fetch)에서만 갱신합니다.

수동 유지: BofA B&B, 풋/콜 비율, GS B/B (무료·일치 티커 한계)

스케줄: GitHub Actions는 UTC cron입니다. 한국 08:20 KST = 전날 UTC 23:20 → cron: "20 23 * * *"
(미국 정규장 종가·정산 후 여유 — 서머타임 시 장 마감 ≈ KST 05:00, 겨울 ≈ 06:00 권장 반영 시간대와 맞춤)
설정은 .github/workflows/auto-update-panic.yml 참고.

Yahoo 일봉: 미국 동부 기준 당일 봉이 아직 ‘종가 확정 전’이면(평일 ET 16:15 이전) 마지막 행을 제외해 직전 완료 거래일 종가를 씁니다.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent
PANIC_JSON = ROOT / "panic-data.json"
PANIC_JS = ROOT / "panic-data.js"
UA = "yds-investment-insights-bot/1.0"


def now_kst_string() -> str:
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    return f"{now:%Y.%m.%d %H:%M} KST"


def decimal_places(text: str | None, fallback: int = 2) -> int:
    cleaned = re.sub(r"[^0-9.]", "", str(text or ""))
    m = re.search(r"\.(\d+)", cleaned)
    return len(m.group(1)) if m else fallback


def precision_by_id(item_id: str, fallback: int) -> int:
    if item_id == "fng":
        return 0
    if item_id == "hy":
        return 2
    return fallback


def format_value(value: float, prev_text: str, is_percent: bool, digits: int) -> str:
    return f"{value:.{digits}f}{'%' if is_percent else ''}"


def format_delta(now: float, prev: float, is_percent: bool, digits: int) -> str:
    if not (isinstance(now, (int, float)) and isinstance(prev, (int, float))):
        return "-"
    diff = now - prev
    if diff == 0:
        return f"➡️ 0{'%' if is_percent else ''}"
    icon = "📈" if diff > 0 else "📉"
    sign = "+" if diff > 0 else "-"
    rounded = f"{abs(diff):.{digits}f}"
    if float(rounded) == 0:
        return f"➡️ 0{'%' if is_percent else ''}"
    return f"{icon} {sign}{rounded}{'%' if is_percent else ''}"


def tone_and_status(item_id: str, value: float) -> tuple[str | None, str | None]:
    if not isinstance(value, (int, float)) or not (value == value):  # NaN
        return "watch", "🟡 점검 필요"
    if item_id == "vix":
        if value < 20:
            return "stable", "🟢 안정"
        if value < 28:
            return "watch", "🟡 주의"
        return "alert", "🔴 위험"
    if item_id == "fng":
        if value >= 75:
            return "watch", "🟡 탐욕"
        if value <= 25:
            return "alert", "🔴 공포"
        return "stable", "🟢 중립"
    if item_id == "skew":
        if value >= 145:
            return "alert", "🔴 위험"
        if value >= 135:
            return "watch", "🟡 주의"
        return "stable", "🟢 안정"
    if item_id == "hy":
        if value < 4:
            return "stable", "🟢 안정"
        if value <= 5:
            return "watch", "🟡 주의"
        return "alert", "🔴 위험"
    if item_id == "move":
        if value < 110:
            return "stable", "🟢 안정"
        if value <= 130:
            return "watch", "🟡 주의"
        return "alert", "🔴 위험"
    if item_id == "vxn":
        if value < 25:
            return "stable", "🟢 안정"
        if value <= 35:
            return "watch", "🟡 주의"
        return "alert", "🔴 위험"
    return None, None


def action_guide_by_tone(tone: str | None) -> str:
    if tone == "alert":
        return "헤지점검"
    if tone == "watch":
        return "분할매수"
    return "관망"


def week_trend_from_ref(item_id: str, latest: float, ref: float) -> str:
    if not all(isinstance(x, (int, float)) and x == x for x in (latest, ref)):
        return "보합"
    if item_id == "hy":
        d = latest - ref
        if d > 0.06:
            return "상승"
        if d < -0.06:
            return "하락"
        return "보합"
    if ref == 0:
        return "보합"
    pct = (latest - ref) / ref * 100
    if pct > 0.45:
        return "상승"
    if pct < -0.45:
        return "하락"
    return "보합"


def settled_us_close_series(closes: pd.Series) -> pd.Series:
    """미국 동부 당일 일봉이 종가 확정 전이면 제거(평일 ET 16:15 이전)."""
    if closes is None or len(closes) < 2:
        return closes
    et = ZoneInfo("America/New_York")
    now_et = datetime.now(et)
    last_idx = closes.index[-1]
    ts = pd.Timestamp(last_idx)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    last_et_date = ts.astimezone(et).date()
    today_et = now_et.date()
    is_weekday = now_et.weekday() < 5
    mins = now_et.hour * 60 + now_et.minute
    if last_et_date == today_et and is_weekday and mins < 16 * 60 + 15:
        return closes.iloc[:-1]
    return closes


def yahoo_panic_row(symbol: str, item_id: str) -> tuple[float, float, str]:
    hist = yf.Ticker(symbol).history(period="3mo", auto_adjust=False)
    closes = settled_us_close_series(hist["Close"].dropna())
    if len(closes) < 6:
        raise ValueError(f"{symbol}: insufficient rows ({len(closes)})")
    latest = float(closes.iloc[-1])
    previous = float(closes.iloc[-2])
    ref = float(closes.iloc[-6])
    return latest, previous, week_trend_from_ref(item_id, latest, ref)


def fetch_fred_series_values(series_id: str) -> list[float]:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={urllib.parse.quote(series_id)}"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode("utf-8", errors="replace")
    lines = text.strip().splitlines()[1:]
    values: list[float] = []
    for line in lines:
        parts = line.split(",")
        if len(parts) < 2 or parts[1] in ("", "."):
            continue
        try:
            values.append(float(parts[1]))
        except ValueError:
            continue
    if len(values) < 2:
        raise ValueError(f"fred rows insufficient: {series_id}")
    return values


def fred_hy_row() -> tuple[float, float, str]:
    vals = fetch_fred_series_values("BAMLH0A0HYM2")
    latest = vals[-1]
    previous = vals[-2]
    ref = vals[-6] if len(vals) >= 6 else vals[0]
    return latest, previous, week_trend_from_ref("hy", latest, ref)


def apply_update(item: dict, latest: float, previous: float, week_trend: str) -> None:
    is_percent = "%" in str(item.get("value") or "")
    base_digits = decimal_places(item.get("value"), 2 if is_percent else 2)
    digits = precision_by_id(str(item.get("id")), base_digits)
    item["value"] = format_value(latest, str(item.get("value")), is_percent, digits)
    item["delta"] = format_delta(latest, previous, is_percent, digits)
    item["weekTrend"] = week_trend
    tid = str(item.get("id"))
    tone, status = tone_and_status(tid, latest)
    if tone:
        item["tone"] = tone
    if status:
        item["status"] = status
    if item.get("tone"):
        item["actionGuide"] = action_guide_by_tone(str(item["tone"]))


def main() -> None:
    raw = PANIC_JSON.read_text(encoding="utf-8")
    data = json.loads(raw)
    items = data.get("items") or []
    by_id = {str(it.get("id")): it for it in items}

    tasks: list[tuple[str, callable]] = [
        ("vix", lambda: yahoo_panic_row("^VIX", "vix")),
        ("skew", lambda: yahoo_panic_row("^SKEW", "skew")),
        ("hy", lambda: fred_hy_row()),
        ("move", lambda: yahoo_panic_row("^MOVE", "move")),
        ("vxn", lambda: yahoo_panic_row("^VXN", "vxn")),
    ]

    log: list[str] = []
    for tid, runner in tasks:
        item = by_id.get(tid)
        if not item:
            log.append(f"[SKIP] {tid} not in JSON")
            continue
        try:
            latest, previous, week_trend = runner()
            apply_update(item, latest, previous, week_trend)
            if tid == "hy":
                item["source"] = "fred"
            else:
                item["source"] = "yahoo"
            log.append(f"[OK] {tid} updated")
        except Exception as exc:  # noqa: BLE001
            log.append(f"[SKIP] {tid} {exc}")

    data["updatedAt"] = f"{now_kst_string()} (자동 업데이트 · Python)"
    PANIC_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PANIC_JS.write_text(
        "window.PANIC_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print("panic-data.json / panic-data.js 업데이트 완료 (update_data.py)")
    for line in log:
        print(line)
    print("고정값(수동 유지): bofa, putcall, gsbb · CNN F&G는 patch-fng-from-cnn.mjs에서 처리")


if __name__ == "__main__":
    main()
