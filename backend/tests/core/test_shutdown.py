from unittest.mock import AsyncMock, patch

from app.core.startup import run_shutdown


async def test_run_shutdown_disposes_engine():
    with patch(
        "app.core.startup._dispose_engine", new_callable=AsyncMock
    ) as dispose:
        await run_shutdown()
        dispose.assert_awaited_once()
