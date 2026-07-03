import logging
import re
import sys
from datetime import datetime


_RESET = "\033[0m"
_DIM = "\033[2m"
_BOLD = "\033[1m"
_ANSI_RE = re.compile(r"\033\[[0-9;]*m")

_METHOD_WIDTH = 7
_PATH_WIDTH = 40
_STATUS_WIDTH = 3
_DURATION_WIDTH = 8
_REQUEST_ID_WIDTH = 8
_CLIENT_WIDTH = 15

_LEVEL_COLORS = {
    "DEBUG": "\033[36m",
    "INFO": "\033[32m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[35m",
}

_METHOD_COLORS = {
    "GET": "\033[36m",
    "POST": "\033[34m",
    "PUT": "\033[33m",
    "PATCH": "\033[33m",
    "DELETE": "\033[31m",
}


def _status_color(code: int) -> str:
    if code < 300:
        return "\033[32m"
    if code < 400:
        return "\033[36m"
    if code < 500:
        return "\033[33m"
    return "\033[31m"


def _duration_color(ms: float) -> str:
    if ms < 100:
        return "\033[32m"
    if ms < 500:
        return "\033[33m"
    return "\033[31m"


def _visible_len(text: str) -> int:
    return len(_ANSI_RE.sub("", text))


def _truncate(text: str, width: int) -> str:
    if len(text) <= width:
        return text
    if width <= 1:
        return text[:width]
    return text[: width - 1] + "…"


def _pad(text: str, width: int, *, align: str = "left") -> str:
    padding = width - _visible_len(text)
    if padding <= 0:
        return text
    if align == "right":
        return (" " * padding) + text
    return text + (" " * padding)


def _col(text: str, width: int, color: str = "", *, align: str = "left") -> str:
    cell = _truncate(text, width)
    cell = _pad(cell, width, align=align)
    if color:
        return f"{color}{cell}{_RESET}"
    return cell


def _format_prefix(record: logging.LogRecord, *, use_color: bool) -> str:
    ts = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
    level = record.levelname
    if not use_color:
        return f"{ts} {level:<7}"
    level_c = _LEVEL_COLORS.get(level, "")
    return f"{_DIM}{ts}{_RESET} {level_c}{level:<7}{_RESET}"


def _label_color(status: str) -> str:
    if status in ("ok", "on"):
        return "\033[32m"
    if status in ("off",):
        return "\033[33m"
    if status in ("failed", "error"):
        return "\033[31m"
    return ""


class StatusLogFormatter(logging.Formatter):
    def __init__(self, *, use_color: bool) -> None:
        super().__init__()
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        kind = getattr(record, "kind", "")
        detail = getattr(record, "detail", "")
        status = getattr(record, "status", "")
        prefix = _format_prefix(record, use_color=self.use_color)

        if not self.use_color:
            row = "  ".join(
                [
                    _col(kind, _METHOD_WIDTH),
                    _col(detail, _PATH_WIDTH),
                    _col(status, _STATUS_WIDTH, align="right"),
                ]
            )
            return f"{prefix} {row}"

        kind_c = _METHOD_COLORS.get(kind, _BOLD) if kind in _METHOD_COLORS else _BOLD
        status_c = _label_color(status)

        row = "  ".join(
            [
                _col(kind, _METHOD_WIDTH, kind_c if kind else ""),
                _col(detail, _PATH_WIDTH),
                _col(status, _STATUS_WIDTH, status_c, align="right"),
            ]
        )
        return f"{prefix} {row}"


class ColoredFormatter(logging.Formatter):
    def __init__(self, *, use_color: bool) -> None:
        super().__init__()
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        message = record.getMessage()
        base = f"{_format_prefix(record, use_color=self.use_color)} {message}"
        if record.exc_info:
            if not record.exc_text:
                record.exc_text = self.formatException(record.exc_info)
            return f"{base}\n{record.exc_text}"
        return base


class AccessLogFormatter(logging.Formatter):
    def __init__(self, *, use_color: bool) -> None:
        super().__init__()
        self.use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        method = getattr(record, "method", "")
        path = getattr(record, "path", "")
        status = getattr(record, "status_code", 0)
        duration_ms = getattr(record, "duration_ms", 0.0)
        client = getattr(record, "client", "-")
        request_id = getattr(record, "request_id", "")
        request_id_short = request_id.replace("-", "")[:8] if request_id else ""
        duration = f"{duration_ms:.1f}ms"
        prefix = _format_prefix(record, use_color=self.use_color)

        if not self.use_color:
            row = "  ".join(
                [
                    _col(method, _METHOD_WIDTH),
                    _col(path, _PATH_WIDTH),
                    _col(str(status), _STATUS_WIDTH, align="right"),
                    _col(duration, _DURATION_WIDTH, align="right"),
                    _col(request_id_short, _REQUEST_ID_WIDTH),
                    _col(client, _CLIENT_WIDTH),
                ]
            )
            return f"{prefix} {row}"

        method_c = _METHOD_COLORS.get(method, _BOLD)
        status_c = _status_color(status)
        duration_c = _duration_color(duration_ms)

        row = "  ".join(
            [
                _col(method, _METHOD_WIDTH, method_c),
                _col(path, _PATH_WIDTH),
                _col(str(status), _STATUS_WIDTH, status_c, align="right"),
                _col(duration, _DURATION_WIDTH, duration_c, align="right"),
                _col(request_id_short, _REQUEST_ID_WIDTH, _DIM),
                _col(client, _CLIENT_WIDTH, _DIM),
            ]
        )
        return f"{prefix} {row}"


def log_status(kind: str, detail: str, status: str = "") -> None:
    logging.getLogger("app.status").info(
        "",
        extra={"kind": kind, "detail": detail, "status": status},
    )


def setup_logging(*, level: str = "INFO", color: bool = True) -> None:
    # Trust the config flag; don't gate on isatty() — Docker pipes stdout even
    # when the terminal renders ANSI fine (e.g. `docker compose logs --no-log-prefix`).
    # stdout (not stderr) so PaaS log collectors that bucket by stream
    # (Railway, etc.) don't flag every INFO line as an error.
    use_color = color

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(ColoredFormatter(use_color=use_color))
    root.addHandler(handler)

    # Dedicated access logger used by RequestLoggingMiddleware.
    access = logging.getLogger("app.access")
    access.handlers.clear()
    access.propagate = False
    access.setLevel(level)
    access_handler = logging.StreamHandler(sys.stdout)
    access_handler.setFormatter(AccessLogFormatter(use_color=use_color))
    access.addHandler(access_handler)

    status = logging.getLogger("app.status")
    status.handlers.clear()
    status.propagate = False
    status.setLevel(level)
    status_handler = logging.StreamHandler(sys.stdout)
    status_handler.setFormatter(StatusLogFormatter(use_color=use_color))
    status.addHandler(status_handler)

    # Uvicorn startup/shutdown messages → root (our formatter).
    for name in ("uvicorn", "uvicorn.error"):
        uv = logging.getLogger(name)
        uv.handlers.clear()
        uv.propagate = True

    # Silence uvicorn's own access logger completely — our middleware owns access logs.
    uv_access = logging.getLogger("uvicorn.access")
    uv_access.handlers.clear()
    uv_access.propagate = False
    uv_access.addHandler(logging.NullHandler())
