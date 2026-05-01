#!/usr/bin/env python3
"""
9대 패닉 지수 중 자동 갱신 가능한 행을 업데이트하고 panic-data.json / panic-data.js에 반영합니다.

데이터 원천 (Investing.com / 공식 마감에 맞추기 위한 티커·시리즈 고정):
- VIX / VXN / SKEW / 풋콜: Yahoo Finance (^VIX, ^VXN, ^SKEW, ^PCC) **Adj Close** (없으면 Close)
- MOVE: ^MOVE Adj Close → 실패 시 FRED MOVE (일별 확정치 CSV)
- HY: FRED BAMLH0A0HYM2
- CNN F&G: 여전히 `scripts/patch-fng-from-cnn.mjs`에서만 갱신 (urllib 418 회피)

시간 기준: 미국 동부(US/Eastern) 기준 최근 **완료된** 거래일 종가(Adj Close). 평일 ET 16:15 이전에는 당일 미완료 봉을 제외합니다.
루트 JSON에 `asOfDateET`(YYYY-MM-DD, 마감 기준일)를 기록합니다.

BofA / GS: 무료 API가 불안정하므로 기본은 JSON 유지. 아래 MANUAL_* 에 숫자를 넣으면 해당 값으로만 덮어씁니다.
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
import pandas as pd
import yfinance as yf
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
PANIC_JSON = ROOT / "panic-data.json"
PANIC_JS = ROOT / "panic-data.js"
UA = "yds-investment-insights-bot/1.0"

# ---------------------------------------------------------------------------
# BofA Bull & Bear / GS B/B — 자동 수집 없음. None이면 JSON 기존 값 유지.
# 숫자를 넣으면 전일 종가(JSON의 현재 value) 대비 델타로 반영합니다.
# 예: MANUAL_BOFA_VALUE = 6.25
# ---------------------------------------------------------------------------
MANUAL_BOFA_VALUE: float | None = None
MANUAL_GSBB_VALUE: float | None = None  # 퍼센트 지수면 68.0 처럼 입력 (표시는 % 붙음)


def round2(x: float) -> float:
    return round(float(x), 2)


def now_kst_string() -> str:
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    return f"{now:%Y.%m.%d %H:%M} KST"


def parse_value_float(text: str | None) -> float | None:
    cleaned = re.sub(r"[^0-9.\-]", "", str(text or ""))
    if not cleaned:
        return None
    try:
        v = float(cleaned)
    except ValueError:
        return None
    return v if v == v else None  # NaN


def decimal_places(text: str | None, fallback: int = 2) -> int:
    cleaned = re.sub(r"[^0-9.]", "", str(text or ""))
    m = re.search(r"\.(\d+)", cleaned)
    return len(m.group(1)) if m else fallback


def precision_by_id(item_id: str, fallback: int) -> int:
    if item_id == "fng":
        return 0
    if item_id in ("hy", "vix", "skew", "move", "vxn", "putcall", "bofa", "gsbb"):
        return 2
    return fallback


def format_value(value: float, prev_text: str, is_percent: bool, digits: int) -> str:
    return f"{value:.{digits}f}{'%' if is_percent else ''}"


def format_delta(now: float, prev: float, is_percent: bool, digits: int) -> str:
    if not (isinstance(now, (int, float)) and isinstance(prev, (int, float))):
        return "-"
    diff = round2(now - prev)
    if diff == 0:
        return f"➡️ 0{'%' if is_percent else ''}"
    icon = "📈" if diff > 0 else "📉"
    sign = "+" if diff > 0 else "-"
    rounded = f"{abs(diff):.{digits}f}"
    if float(rounded) == 0:
        return f"➡️ 0{'%' if is_percent else ''}"
    return f"{icon} {sign}{rounded}{'%' if is_percent else ''}"


def tone_and_status(item_id: str, value: float) -> tuple[str | None, str | None]:
    if not isinstance(value, (int, float)) or not (value == value):
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
    if item_id == "putcall":
        if value >= 1.35:
            return "alert", "🔴 위험"
        if value >= 1.2:
            return "watch", "🟡 주의"
        return "stable", "🟢 안정"
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


def last_bar_date_et(closes: pd.Series) -> str:
    """마지막 봉 인덱스를 US/Eastern 날짜 YYYY-MM-DD 로."""
    if closes is None or len(closes) == 0:
        return ""
    last_idx = closes.index[-1]
    ts = pd.Timestamp(last_idx)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    return ts.astimezone(ZoneInfo("America/New_York")).strftime("%Y-%m-%d")


def adj_close_series(hist: pd.DataFrame) -> pd.Series:
    """우선 Adj Close, 전부 NaN이면 Close."""
    if hist is None or len(hist) == 0:
        raise ValueError("empty history")
    if "Adj Close" in hist.columns:
        adj = hist["Adj Close"].astype(float)
        close = hist["Close"].astype(float) if "Close" in hist.columns else adj
        s = adj.fillna(close)
    else:
        s = hist["Close"].astype(float)
    return s.dropna()


def yahoo_adj_history(symbol: str) -> pd.DataFrame:
    return yf.Ticker(symbol).history(period="3mo", auto_adjust=False)


def yahoo_panic_row_adj(symbol: str, item_id: str) -> tuple[float, float, str]:
    hist = yahoo_adj_history(symbol)
    closes = settled_us_close_series(adj_close_series(hist))
    if len(closes) < 6:
        raise ValueError(f"{symbol}: insufficient rows ({len(closes)})")
    latest = round2(float(closes.iloc[-1]))
    previous = round2(float(closes.iloc[-2]))
    ref = round2(float(closes.iloc[-6]))
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


def fred_numeric_row(series_id: str, item_id: str) -> tuple[float, float, str]:
    vals = fetch_fred_series_values(series_id)
    latest = round2(vals[-1])
    previous = round2(vals[-2])
    ref = round2(vals[-6] if len(vals) >= 6 else vals[0])
    return latest, previous, week_trend_from_ref(item_id, latest, ref)


def move_row() -> tuple[float, float, str, str]:
    try:
        a, b, c = yahoo_panic_row_adj("^MOVE", "move")
        return a, b, c, "yahoo"
    except Exception:
        pass
    try:
        a, b, c = fred_numeric_row("MOVE", "move")
        return a, b, c, "fred"
    except Exception as exc:
        raise RuntimeError(f"MOVE: yahoo ^MOVE and FRED MOVE failed: {exc}") from exc


def canonical_as_of_date_et() -> str:
    """배치 기준일: Yahoo 일봉 마지막 봉의 ET 날짜 (^VIX 우선, 실패 시 ^VXN)."""
    for sym in ("^VIX", "^VXN"):
        try:
            hist = yahoo_adj_history(sym)
            closes = settled_us_close_series(adj_close_series(hist))
            d = last_bar_date_et(closes)
            if d:
                return d
        except Exception:
            continue
    return ""


def apply_update(item: dict, latest: float, previous: float, week_trend: str) -> None:
    latest = round2(latest)
    previous = round2(previous)
    is_percent = "%" in str(item.get("value") or "")
    base_digits = decimal_places(item.get("value"), 2)
    digits = precision_by_id(str(item.get("id")), base_digits)
    item["value"] = format_value(latest, str(item.get("value")), is_percent, digits)
    item["delta"] = format_delta(latest, previous, is_percent, digits)
    item["weekTrend"] = week_trend
    item["previousClose"] = previous
    item["change"] = round2(latest - previous)
    tid = str(item.get("id"))
    tone, status = tone_and_status(tid, latest)
    if tone:
        item["tone"] = tone
    if status:
        item["status"] = status
    if item.get("tone"):
        item["actionGuide"] = action_guide_by_tone(str(item["tone"]))


def apply_manual_numeric(item: dict, new_latest: float, log: list[str], source: str) -> None:
    prev = parse_value_float(item.get("value"))
    if prev is None:
        prev = round2(float(new_latest))
    wt = week_trend_from_ref(str(item.get("id")), round2(float(new_latest)), prev)
    apply_update(item, float(new_latest), prev, wt)
    item["source"] = source
    log.append(f"[OK] {item.get('id')} {source}")


def update_manual_indices(by_id: dict, log: list[str]) -> None:
    if MANUAL_BOFA_VALUE is not None:
        it = by_id.get("bofa")
        if it:
            apply_manual_numeric(it, float(MANUAL_BOFA_VALUE), log, "manual_override")
    else:
        log.append("[KEEP] bofa (MANUAL_BOFA_VALUE=None, JSON 유지)")

    if MANUAL_GSBB_VALUE is not None:
        it = by_id.get("gsbb")
        if it:
            apply_manual_numeric(it, float(MANUAL_GSBB_VALUE), log, "manual_override")
    else:
        log.append("[KEEP] gsbb (MANUAL_GSBB_VALUE=None, JSON 유지)")


def main() -> None:
    raw = PANIC_JSON.read_text(encoding="utf-8")
    data = json.loads(raw)
    items = data.get("items") or []
    by_id = {str(it.get("id")): it for it in items}

    as_of = canonical_as_of_date_et()
    if as_of:
        data["asOfDateET"] = as_of

    yahoo_tasks = [
        ("vix", "^VIX", "vix"),
        ("vxn", "^VXN", "vxn"),
        ("skew", "^SKEW", "skew"),
        ("putcall", "^PCC", "putcall"),
    ]

    log: list[str] = []
    for tid, sym, iid in yahoo_tasks:
        item = by_id.get(tid)
        if not item:
            log.append(f"[SKIP] {tid} not in JSON")
            continue
        try:
            latest, previous, week_trend = yahoo_panic_row_adj(sym, iid)
            apply_update(item, latest, previous, week_trend)
            item["source"] = "yahoo"
            log.append(f"[OK] {tid} updated")
        except Exception as exc:  # noqa: BLE001
            log.append(f"[SKIP] {tid} {exc}")

    item_move = by_id.get("move")
    if item_move:
        try:
            latest, previous, week_trend, src = move_row()
            apply_update(item_move, latest, previous, week_trend)
            item_move["source"] = src
            log.append("[OK] move updated")
        except Exception as exc:  # noqa: BLE001
            log.append(f"[SKIP] move {exc}")

    item_hy = by_id.get("hy")
    if item_hy:
        try:
            latest, previous, week_trend = fred_numeric_row("BAMLH0A0HYM2", "hy")
            apply_update(item_hy, latest, previous, week_trend)
            item_hy["source"] = "fred"
            log.append("[OK] hy updated")
        except Exception as exc:  # noqa: BLE001
            log.append(f"[SKIP] hy {exc}")

    update_manual_indices(by_id, log)

    data["updatedAt"] = f"{now_kst_string()} (자동 업데이트 · Python)"
    PANIC_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PANIC_JS.write_text(
        "window.PANIC_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print("panic-data.json / panic-data.js 업데이트 완료 (update_data.py)")
    if data.get("asOfDateET"):
        print("asOfDateET (US/Eastern 기준 종가일):", data["asOfDateET"])
    for line in log:
        print(line)
    print("CNN F&G는 scripts/patch-fng-from-cnn.mjs 에서 갱신합니다.")


if __name__ == "__main__":
    main()
