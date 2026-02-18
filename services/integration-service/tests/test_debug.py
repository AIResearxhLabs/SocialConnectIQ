
import pytest
from unittest.mock import MagicMock, patch

def test_simple():
    assert 1 + 1 == 2

@pytest.mark.asyncio
async def test_async_simple():
    assert True
