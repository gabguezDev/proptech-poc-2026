import pandas as pd
from src.models.cosine_model import CosineRecommender


def test_cosine_recommender_score_range():
  data = [
      {
          "id": 1,
          "titulo": "A",
          "precio_norm": 0.5,
          "ambientes_norm": 0.5,
          "acepta_mascotas": 1,
          "tiene_balcon": 1,
      },
      {
          "id": 2,
          "titulo": "B",
          "precio_norm": 0.0,
          "ambientes_norm": 0.0,
          "acepta_mascotas": 0,
          "tiene_balcon": 0,
      },
  ]
  df = pd.DataFrame(data)
  features = ["precio_norm", "ambientes_norm", "acepta_mascotas", "tiene_balcon"]

  recommender = CosineRecommender(feature_cols=features)
  result = recommender.predict(df, [0.5, 0.5, 1, 1])

  assert (result["score_compatibilidad"] >= 0).all()
  assert (result["score_compatibilidad"] <= 100).all()

  assert (
      result.iloc[0]["score_compatibilidad"]
      > result.iloc[1]["score_compatibilidad"]
  )