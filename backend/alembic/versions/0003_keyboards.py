"""keyboards table and run keyboard columns

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "keyboards",
        sa.Column(
            "id",
            sa.Uuid(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("layout", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_keyboards_user_id", "keyboards", ["user_id"])

    op.add_column("runs", sa.Column("keyboard_id", sa.Uuid(), nullable=True))
    op.add_column(
        "runs", sa.Column("keyboard_layout", sa.String(length=16), nullable=True)
    )
    op.create_foreign_key(
        "fk_runs_keyboard_id",
        "runs",
        "keyboards",
        ["keyboard_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_runs_keyboard_id", "runs", ["keyboard_id"])
    op.create_index("runs_user_keyboard", "runs", ["user_id", "keyboard_id"])
    op.create_index("runs_user_layout", "runs", ["user_id", "keyboard_layout"])


def downgrade() -> None:
    op.drop_index("runs_user_layout", table_name="runs")
    op.drop_index("runs_user_keyboard", table_name="runs")
    op.drop_index("ix_runs_keyboard_id", table_name="runs")
    op.drop_constraint("fk_runs_keyboard_id", "runs", type_="foreignkey")
    op.drop_column("runs", "keyboard_layout")
    op.drop_column("runs", "keyboard_id")
    op.drop_index("ix_keyboards_user_id", table_name="keyboards")
    op.drop_table("keyboards")
