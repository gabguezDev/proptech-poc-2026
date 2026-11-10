import pytest

from src import metrics


def test_precision_at_k():
  relevancia = [1, 0, 1, 0]
  assert metrics.precision_at_k(relevancia, 2) == pytest.approx(0.5)
  assert metrics.precision_at_k(relevancia, 3) == pytest.approx(2 / 3)
  assert metrics.precision_at_k(relevancia, 0) == 0.0


def test_recall_at_k():
  relevancia = [1, 0, 1, 0]
  assert metrics.recall_at_k(relevancia, 2, 2) == pytest.approx(0.5)
  assert metrics.recall_at_k(relevancia, 4, 2) == pytest.approx(1.0)
  assert metrics.recall_at_k(relevancia, 4, 0) == 0.0


def test_ndcg_at_k_perfecto_y_peor():
  assert metrics.ndcg_at_k([1, 1, 0, 0], 4) == pytest.approx(1.0)
  peor = metrics.ndcg_at_k([0, 0, 1, 1], 4)
  assert 0.0 < peor < 1.0
  assert metrics.ndcg_at_k([0, 0, 0], 3) == 0.0


def test_average_precision():
  assert metrics.average_precision([1, 0, 1]) == pytest.approx((1.0 + 2 / 3) / 2)
  assert metrics.average_precision([0, 0, 0]) == 0.0
  assert metrics.average_precision([1, 1]) == pytest.approx(1.0)


def test_reciprocal_rank():
  assert metrics.reciprocal_rank([0, 0, 1]) == pytest.approx(1 / 3)
  assert metrics.reciprocal_rank([1, 0, 0]) == pytest.approx(1.0)
  assert metrics.reciprocal_rank([0, 0, 0]) == 0.0


def test_spearman():
  assert metrics.spearman([1, 2, 3], [1, 2, 3]) == pytest.approx(1.0)
  assert metrics.spearman([1, 2, 3], [3, 2, 1]) == pytest.approx(-1.0)


def test_spearman_datos_insuficientes():
  assert metrics.spearman([1.0], [1.0]) != metrics.spearman([1.0], [1.0])
