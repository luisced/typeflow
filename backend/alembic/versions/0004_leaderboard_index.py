"""leaderboard index on runs mode+value

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-10

"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("runs_mode_value", "runs", ["mode", "value"])


def downgrade() -> None:
    op.drop_index("runs_mode_value", table_name="runs")
