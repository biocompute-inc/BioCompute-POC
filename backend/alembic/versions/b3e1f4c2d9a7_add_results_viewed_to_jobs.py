"""add results_viewed to jobs

Revision ID: b3e1f4c2d9a7
Revises: a0c0625ed1ba
Create Date: 2026-03-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e1f4c2d9a7'
down_revision: Union[str, Sequence[str], None] = 'a0c0625ed1ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'jobs',
        sa.Column('results_viewed', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column('jobs', 'results_viewed')
